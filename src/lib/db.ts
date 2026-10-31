import type { Client } from "@libsql/client";

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
