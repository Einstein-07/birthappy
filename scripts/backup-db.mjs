#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  formatBytes,
  openDatabase,
  projectRoot
} from "./lib/db-config.mjs";

function blobToBase64(value) {
  if (value == null) return null;
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value).toString("base64");
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }
  return null;
}

function nowFileStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

const database = await openDatabase();

try {
  const [
    usersResult,
    blessingsResult,
    cutsResult,
    quotasResult,
    schemaResult
  ] = await Promise.all([
      database.client.execute(
        `SELECT id, account, password_hash, name, bio, birthday,
                is_anonymous, avatar, avatar_mime, email, email_verified_at,
                uid, uid_change_count, created_at, updated_at
         FROM users
         ORDER BY created_at ASC, id ASC`
      ),
      database.client.execute(
        `SELECT id, sender_id, recipient_id, kind, year, created_at, responded_at
         FROM blessings
         ORDER BY created_at ASC, id ASC`
      ),
      database.client.execute(
        `SELECT id, user_id, wish_count, share_count, created_at
         FROM cake_cuts
         ORDER BY created_at ASC, id ASC`
      ),
      database.client.execute(
        `SELECT user_id, kind, period, used, updated_at
         FROM change_quotas
         ORDER BY user_id ASC, kind ASC, period ASC`
      ),
      database.client.execute(
        `SELECT type, name, tbl_name, sql
         FROM sqlite_master
         WHERE type IN ('table', 'index')
           AND sql IS NOT NULL
           AND tbl_name IN ('users', 'blessings', 'cake_cuts', 'change_quotas')
         ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name ASC`
      )
    ]);

  const users = usersResult.rows.map((row) => ({
    id: row.id,
    account: row.account,
    password_hash: row.password_hash,
    name: row.name,
    bio: row.bio,
    birthday: row.birthday,
    is_anonymous: row.is_anonymous,
    avatar_base64: blobToBase64(row.avatar),
    avatar_mime: row.avatar_mime,
    email: row.email ?? null,
    email_verified_at: row.email_verified_at ?? null,
    uid: row.uid ?? null,
    uid_change_count: row.uid_change_count ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));

  const blessings = blessingsResult.rows.map((row) => ({
    id: row.id,
    sender_id: row.sender_id,
    recipient_id: row.recipient_id,
    kind: row.kind,
    year: row.year,
    created_at: row.created_at,
    responded_at: row.responded_at
  }));

  const cakeCuts = cutsResult.rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    wish_count: row.wish_count,
    share_count: row.share_count,
    created_at: row.created_at
  }));

  const changeQuotas = quotasResult.rows.map((row) => ({
    user_id: row.user_id,
    kind: row.kind,
    period: row.period,
    used: row.used,
    updated_at: row.updated_at
  }));

  const payload = {
    format: "birthappy-backup-v3",
    schemaVersion: 3,
    createdAt: new Date().toISOString(),
    source: database.source,
    counts: {
      users: users.length,
      blessings: blessings.length,
      cakeCuts: cakeCuts.length,
      changeQuotas: changeQuotas.length
    },
    schema: schemaResult.rows.map((row) => ({
      type: row.type,
      name: row.name,
      table: row.tbl_name,
      sql: row.sql
    })),
    users,
    blessings,
    cakeCuts,
    changeQuotas
  };

  const backupDirectory = path.join(projectRoot, "backups");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const outputFile = path.join(
    backupDirectory,
    `birthappy-backup-${nowFileStamp()}.json`
  );

  fs.writeFileSync(outputFile, JSON.stringify(payload), {
    encoding: "utf8",
    mode: 0o600
  });
  const stats = fs.statSync(outputFile);

  console.log("\nBirtHappy 备份完成");
  console.log(`来源：${database.source}`);
  console.log(
    `数据：${users.length} 位用户，${blessings.length} 条祝福，${cakeCuts.length} 次切蛋糕，${changeQuotas.length} 条修改额度`
  );
  console.log(`文件：${outputFile}`);
  console.log(`大小：${formatBytes(stats.size)}\n`);
  console.log(
    "备份包含密码哈希、用户资料和头像，请勿上传到公开仓库或公开网盘。\n"
  );
} finally {
  database.client.close();
}
