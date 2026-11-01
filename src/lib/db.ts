import type { Client } from "@libsql/client";
import { generateUid, legacyUidCandidate } from "@/lib/uid";

const DEFAULT_DATABASE_URL = "file:./data/birthhappy.db";

const globalForDatabase = globalThis as unknown as {
  __birthappyDb?: Client;
  __birthappySchema?: Promise<void>;
};

function resolveDatabaseConfig() {
  const url = process.env.TURSO_DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;
  return { url, authToken };
}

async function createDatabaseClient(): Promise<Client> {
  const { url, authToken } = resolveDatabaseConfig();

  if (url.startsWith("file:")) {
    // 本地开发才加载 Node 原生 SQLite 客户端，远程部署使用纯 HTTP 客户端。
    const [{ createClient }, fs, path] = await Promise.all([
      import("@libsql/client"),
      import("node:fs"),
      import("node:path")
    ]);
    const rawPath = url.slice("file:".length).split("?")[0];
    if (rawPath && rawPath !== ":memory:") {
      const absolutePath = path.resolve(process.cwd(), rawPath);
      fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    }
    return createClient({ url, authToken, intMode: "number" });
  }

  // Netlify / Vercel 等无服务器环境走 libSQL over HTTP，避免打包原生 .node 模块。
  const { createClient } = await import("@libsql/client/web");
  return createClient({ url, authToken, intMode: "number" });
}

async function ensureUserColumns(client: Client) {
  const result = await client.execute("PRAGMA table_info(users)");
  const existing = new Set(result.rows.map((row) => String(row.name)));
  const additions = [
    ["email", "email TEXT"],
    ["email_verified_at", "email_verified_at TEXT"],
    ["uid", "uid TEXT"],
    [
      "uid_change_count",
      "uid_change_count INTEGER NOT NULL DEFAULT 0"
    ]
  ] as const;

  for (const [name, definition] of additions) {
    if (existing.has(name)) continue;
    try {
      await client.execute(`ALTER TABLE users ADD COLUMN ${definition}`);
    } catch (error) {
      const check = await client.execute("PRAGMA table_info(users)");
      const nowExists = check.rows.some((row) => String(row.name) === name);
      if (!nowExists) throw error;
    }
  }
}

async function backfillLegacyUids(client: Client) {
  const result = await client.execute(
    "SELECT id, account FROM users WHERE uid IS NULL OR uid = '' ORDER BY created_at ASC"
  );

  for (const row of result.rows) {
    let candidate = legacyUidCandidate(String(row.account)) ?? generateUid();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const conflict = await client.execute({
        sql: "SELECT id FROM users WHERE uid = ? AND id <> ? LIMIT 1",
        args: [candidate, row.id]
      });
      if (conflict.rows.length === 0) break;
      candidate = generateUid();
    }

    await client.execute({
      sql: "UPDATE users SET uid = ? WHERE id = ? AND (uid IS NULL OR uid = '')",
      args: [candidate, row.id]
    });
  }
}

async function initializeSchema(client: Client) {
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        account TEXT NOT NULL COLLATE NOCASE UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        bio TEXT NOT NULL DEFAULT '',
        birthday TEXT NOT NULL,
        is_anonymous INTEGER NOT NULL DEFAULT 0 CHECK (is_anonymous IN (0, 1)),
        avatar BLOB,
        avatar_mime TEXT,
        email TEXT,
        email_verified_at TEXT,
        uid TEXT,
        uid_change_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_users_birthday ON users (birthday)`,
      `CREATE INDEX IF NOT EXISTS idx_users_birthday_md ON users (substr(birthday, 6, 5))`,
      `CREATE INDEX IF NOT EXISTS idx_users_created ON users (created_at)`,
      `CREATE TABLE IF NOT EXISTS blessings (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('wish', 'cake_share')),
        year INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        responded_at TEXT
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_blessings_unique
        ON blessings (sender_id, recipient_id, kind, year)`,
      `CREATE INDEX IF NOT EXISTS idx_blessings_recipient_year
        ON blessings (recipient_id, year, kind)`,
      `CREATE INDEX IF NOT EXISTS idx_blessings_pending
        ON blessings (recipient_id, kind, responded_at)`,
      `CREATE TABLE IF NOT EXISTS cake_cuts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wish_count INTEGER NOT NULL,
        share_count INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_cake_cuts_user ON cake_cuts (user_id, created_at)`,
      `CREATE TABLE IF NOT EXISTS change_quotas (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN ('profile', 'birthday')),
        period TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
        updated_at TEXT NOT NULL,
        PRIMARY KEY (user_id, kind, period)
      )`
    ],
    "write"
  );

  await ensureUserColumns(client);
  await backfillLegacyUids(client);

  await client.batch(
    [
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
        ON users (email) WHERE email IS NOT NULL`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_users_uid_unique
        ON users (uid) WHERE uid IS NOT NULL`,
      `CREATE TABLE IF NOT EXISTS email_codes (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        user_id TEXT,
        purpose TEXT NOT NULL CHECK (purpose IN ('register', 'bind', 'delete')),
        code_hash TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_email_codes_email
        ON email_codes (email, purpose, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_email_codes_ip
        ON email_codes (ip_hash, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_email_codes_user
        ON email_codes (user_id, purpose, created_at)`,
      `CREATE TABLE IF NOT EXISTS registration_events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        day TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_registration_events_ip_day
        ON registration_events (ip_hash, day)`,
      `CREATE INDEX IF NOT EXISTS idx_registration_events_user
        ON registration_events (user_id)`,
      `CREATE TABLE IF NOT EXISTS daily_registration_counters (
        day TEXT PRIMARY KEY,
        used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0)
      )`
    ],
    "write"
  );
}

export async function getDatabase() {
  if (!globalForDatabase.__birthappyDb) {
    globalForDatabase.__birthappyDb = await createDatabaseClient();
  }

  if (!globalForDatabase.__birthappySchema) {
    globalForDatabase.__birthappySchema = initializeSchema(
      globalForDatabase.__birthappyDb
    ).catch((error) => {
      globalForDatabase.__birthappySchema = undefined;
      throw error;
    });
  }

  await globalForDatabase.__birthappySchema;
  return globalForDatabase.__birthappyDb;
}
