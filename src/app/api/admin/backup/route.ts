import { timingSafeEqual } from "node:crypto";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

function blobToBase64(value: unknown) {
  if (value == null) return null;
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value).toString("base64");
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }
  return null;
}

function tokensMatch(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

function sourceLabel() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) return "local";
  if (url.startsWith("file:")) return url;
  try {
    return new URL(url).host;
  } catch {
    return "remote";
  }
}

export async function POST(request: Request) {
  const expected = process.env.BACKUP_TOKEN?.trim();
  if (!expected || expected.length < 32) {
    return new Response("Not found", { status: 404 });
  }

  const provided = request.headers.get("x-backup-token") ?? "";
  if (!provided || !tokensMatch(provided, expected)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const db = await getDatabase();
    const [
      usersResult,
      blessingsResult,
      cutsResult,
      quotasResult,
      schemaResult
    ] = await Promise.all([
      db.execute(
        `SELECT id, account, password_hash, name, bio, birthday,
                is_anonymous, avatar, avatar_mime, created_at, updated_at
         FROM users
         ORDER BY created_at ASC, id ASC`
      ),
      db.execute(
        `SELECT id, sender_id, recipient_id, kind, year, created_at, responded_at
         FROM blessings
         ORDER BY created_at ASC, id ASC`
      ),
      db.execute(
        `SELECT id, user_id, wish_count, share_count, created_at
         FROM cake_cuts
         ORDER BY created_at ASC, id ASC`
      ),
      db.execute(
        `SELECT user_id, kind, period, used, updated_at
         FROM change_quotas
         ORDER BY user_id ASC, kind ASC, period ASC`
      ),
      db.execute(
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

    const createdAt = new Date();
    const payload = {
      format: "birthappy-backup-v2",
      schemaVersion: 2,
      createdAt: createdAt.toISOString(),
      source: sourceLabel(),
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

    const filename = `birthappy-production-${createdAt
      .toISOString()
      .replace(/[:.]/g, "-")}.json`;

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow"
      }
    });
  } catch (error) {
    console.error("admin backup failed", error);
    return new Response("Backup failed", { status: 500 });
  }
}
