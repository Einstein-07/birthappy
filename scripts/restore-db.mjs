#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { openDatabase } from "./lib/db-config.mjs";

const argumentsList = process.argv.slice(2);
const inputArgument = argumentsList.find((value) => !value.startsWith("--"));
const forced = argumentsList.includes("--force");

if (!inputArgument || !forced) {
  console.error(`
用法：
  node scripts/restore-db.mjs <备份文件.json> --force

说明：
  --force 是必须的，因为恢复会清空目标数据库中的用户、祝福和切蛋糕记录。
  建议先设置 TURSO_DATABASE_URL 指向一个测试库，确认无误后再恢复正式库。
`);
  process.exit(1);
}

const backupFile = path.resolve(process.cwd(), inputArgument);
if (!fs.existsSync(backupFile)) {
  console.error(`找不到备份文件：${backupFile}`);
  process.exit(1);
}

let backup;
try {
  backup = JSON.parse(fs.readFileSync(backupFile, "utf8"));
} catch (error) {
  console.error("备份文件无法解析为 JSON。", error.message);
  process.exit(1);
}

const supportedFormats = ["birthappy-backup-v1", "birthappy-backup-v2"];
if (
  !supportedFormats.includes(backup?.format) ||
  !Array.isArray(backup.users) ||
  !Array.isArray(backup.blessings) ||
  !Array.isArray(backup.cakeCuts) ||
  !Array.isArray(backup.schema)
) {
  console.error("这不是有效的 BirtHappy 备份文件，已停止恢复。");
  process.exit(1);
}

if (backup.changeQuotas != null && !Array.isArray(backup.changeQuotas)) {
  console.error("备份中的 changeQuotas 字段格式不正确。");
  process.exit(1);
}
const changeQuotas = backup.changeQuotas ?? [];

function withIfNotExists(sql) {
  return sql
    .replace(
      /^CREATE\s+TABLE\s+/i,
      "CREATE TABLE IF NOT EXISTS "
    )
    .replace(
      /^CREATE\s+UNIQUE\s+INDEX\s+/i,
      "CREATE UNIQUE INDEX IF NOT EXISTS "
    )
    .replace(
      /^CREATE\s+INDEX\s+/i,
      "CREATE INDEX IF NOT EXISTS "
    );
}

function avatarBytes(base64) {
  if (!base64) return null;
  return new Uint8Array(Buffer.from(base64, "base64"));
}

async function insertInChunks(transaction, statements, label) {
  const chunkSize = 100;
  for (let index = 0; index < statements.length; index += chunkSize) {
    await transaction.batch(statements.slice(index, index + chunkSize));
  }
  console.log(`已恢复 ${label}：${statements.length} 行`);
}

const database = await openDatabase();

try {
  console.log(`\n目标数据库：${database.source}`);
  console.log(`备份文件：${backupFile}`);
  console.log(
    `备份数据：${backup.users.length} 位用户，${backup.blessings.length} 条祝福，${backup.cakeCuts.length} 次切蛋糕，${changeQuotas.length} 条修改额度`
  );

  if (database.isRemote) {
    console.log("\n注意：正在恢复远程 Turso 数据库。--force 已确认。");
  }

  // 先创建缺失的表和索引；已有表不会删除或重建。
  for (const item of backup.schema) {
    if (typeof item.sql !== "string" || !item.sql.trim()) continue;
    await database.client.execute(withIfNotExists(item.sql));
  }

  // v1 备份没有此表；恢复时补建，以便额度数据能够被后续逻辑懒初始化。
  await database.client.execute(
    `CREATE TABLE IF NOT EXISTS change_quotas (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('profile', 'birthday')),
      period TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, kind, period)
    )`
  );

  const transaction = await database.client.transaction("write");
  try {
    await transaction.batch([
      "DELETE FROM cake_cuts",
      "DELETE FROM blessings",
      "DELETE FROM change_quotas",
      "DELETE FROM users"
    ]);

    const userStatements = backup.users.map((user) => ({
      sql: `INSERT INTO users
        (id, account, password_hash, name, bio, birthday, is_anonymous,
         avatar, avatar_mime, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        user.id,
        user.account,
        user.password_hash,
        user.name,
        user.bio ?? "",
        user.birthday,
        Number(user.is_anonymous) === 1 ? 1 : 0,
        avatarBytes(user.avatar_base64),
        user.avatar_mime ?? null,
        user.created_at,
        user.updated_at
      ]
    }));

    const blessingStatements = backup.blessings.map((blessing) => ({
      sql: `INSERT INTO blessings
        (id, sender_id, recipient_id, kind, year, created_at, responded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        blessing.id,
        blessing.sender_id,
        blessing.recipient_id,
        blessing.kind,
        blessing.year,
        blessing.created_at,
        blessing.responded_at ?? null
      ]
    }));

    const cutStatements = backup.cakeCuts.map((cut) => ({
      sql: `INSERT INTO cake_cuts
        (id, user_id, wish_count, share_count, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      args: [
        cut.id,
        cut.user_id,
        cut.wish_count,
        cut.share_count,
        cut.created_at
      ]
    }));

    const quotaStatements = changeQuotas.map((quota) => ({
      sql: `INSERT INTO change_quotas
        (user_id, kind, period, used, updated_at)
        VALUES (?, ?, ?, ?, ?)`,
      args: [
        quota.user_id,
        quota.kind,
        quota.period,
        quota.used,
        quota.updated_at
      ]
    }));

    await insertInChunks(transaction, userStatements, "用户");
    await insertInChunks(transaction, quotaStatements, "修改额度");
    await insertInChunks(transaction, blessingStatements, "祝福");
    await insertInChunks(transaction, cutStatements, "切蛋糕记录");

    const counts = await Promise.all([
      transaction.execute("SELECT COUNT(*) AS count FROM users"),
      transaction.execute("SELECT COUNT(*) AS count FROM blessings"),
      transaction.execute("SELECT COUNT(*) AS count FROM cake_cuts"),
      transaction.execute("SELECT COUNT(*) AS count FROM change_quotas")
    ]);
    const actual = {
      users: Number(counts[0].rows[0]?.count ?? 0),
      blessings: Number(counts[1].rows[0]?.count ?? 0),
      cakeCuts: Number(counts[2].rows[0]?.count ?? 0),
      changeQuotas: Number(counts[3].rows[0]?.count ?? 0)
    };
    const expected = {
      users: backup.users.length,
      blessings: backup.blessings.length,
      cakeCuts: backup.cakeCuts.length,
      changeQuotas: changeQuotas.length
    };

    if (
      actual.users !== expected.users ||
      actual.blessings !== expected.blessings ||
      actual.cakeCuts !== expected.cakeCuts ||
      actual.changeQuotas !== expected.changeQuotas
    ) {
      throw new Error(
        `恢复后的行数不一致：${JSON.stringify(actual)}，预期 ${JSON.stringify(expected)}`
      );
    }

    await transaction.commit();

    console.log(
      `\n恢复完成：${actual.users} 位用户，${actual.blessings} 条祝福，${actual.cakeCuts} 次切蛋糕，${actual.changeQuotas} 条修改额度。`
    );
    console.log("请在网站上刷新并登录一个账号，确认数据正常。\n");
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
} catch (error) {
  console.error("\n恢复失败，数据库改动已回滚（表结构创建除外）。");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  database.client.close();
}
