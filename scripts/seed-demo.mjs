#!/usr/bin/env node
/**
 * 本地演示数据。默认只允许写入 file: 数据库。
 * 如果确实想写入远程演示库，请显式追加 --force。
 */
import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

function loadEnvFile(filename) {
  const file = path.join(projectRoot, filename);
  if (!fs.existsSync(file)) return;
  const contents = fs.readFileSync(file, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url =
  process.env.TURSO_DATABASE_URL?.trim() || "file:./data/birthhappy.db";
const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

if (!url.startsWith("file:") && !process.argv.includes("--force")) {
  console.error(
    "拒绝向远程数据库写入演示数据。确实需要时，请追加 --force，并确认那不是正式环境。"
  );
  process.exit(1);
}

if (url.startsWith("file:")) {
  const rawPath = url.slice("file:".length).split("?")[0];
  if (rawPath && rawPath !== ":memory:") {
    fs.mkdirSync(path.dirname(path.resolve(projectRoot, rawPath)), {
      recursive: true
    });
  }
}

const db = createClient({ url, authToken, intMode: "number" });

function todayParts() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(new Date());
  const map = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );
  return {
    year: Number(map.year),
    month: map.month,
    day: map.day,
    monthDay: `${map.month}-${map.day}`
  };
}

const today = todayParts();
const toIso = (monthDay, fallbackYear) =>
  `${fallbackYear}-${monthDay}`;
const currentYear = today.year;
const now = new Date().toISOString();
const previousYearDate = new Date(
  Date.UTC(currentYear - 1, 5, 12, 10, 0, 0)
).toISOString();

const users = [
  {
    id: "demo-xiaoman",
    account: "xiaoman",
    name: "林小满",
    bio: "爱把日子过成一首很慢的诗。",
    birthday: toIso(today.monthDay, 1996),
    isAnonymous: 0,
    avatar: "lin.jpg",
    isToday: true
  },
  {
    id: "demo-yuan",
    account: "yuan",
    name: "周予安",
    bio: "咖啡、旧唱片，还有一点点晚风。",
    birthday: toIso(today.monthDay, 1993),
    isAnonymous: 0,
    avatar: "zhou.jpg",
    isToday: true
  },
  {
    id: "demo-acheng",
    account: "acheng",
    name: "阿澄",
    bio: "",
    birthday: toIso(today.monthDay, 1998),
    isAnonymous: 1,
    avatar: null,
    isToday: true
  },
  {
    id: "demo-zhiyao",
    account: "zhiyao",
    name: "宋知遥",
    bio: "在很远的地方，认真看云。",
    birthday: toIso("11-08", 1995),
    isAnonymous: 0,
    avatar: null,
    isToday: false
  },
  {
    id: "demo-nan",
    account: "nan",
    name: "南屿",
    bio: "今天也要好好吃饭。",
    birthday: toIso("03-14", 1997),
    isAnonymous: 0,
    avatar: null,
    isToday: false
  }
];

await db.batch(
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
    `CREATE INDEX IF NOT EXISTS idx_cake_cuts_user ON cake_cuts (user_id, created_at)`
  ],
  "write"
);

const passwordHash = await bcrypt.hash("birthhappy123", 11);
const ids = users.map((user) => user.id);
const placeholders = ids.map(() => "?").join(", ");

await db.batch(
  [
    {
      sql: `DELETE FROM cake_cuts WHERE user_id IN (${placeholders})`,
      args: ids
    },
    {
      sql: `DELETE FROM blessings WHERE sender_id IN (${placeholders}) OR recipient_id IN (${placeholders})`,
      args: [...ids, ...ids]
    }
  ],
  "write"
);

for (const user of users) {
  let avatar = null;
  let avatarMime = null;
  if (user.avatar) {
    avatar = new Uint8Array(
      fs.readFileSync(path.join(scriptDir, "assets", user.avatar))
    );
    avatarMime = "image/jpeg";
  }

  await db.execute({
    sql: `INSERT INTO users
      (id, account, password_hash, name, bio, birthday, is_anonymous, avatar, avatar_mime, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        account = excluded.account,
        password_hash = excluded.password_hash,
        name = excluded.name,
        bio = excluded.bio,
        birthday = excluded.birthday,
        is_anonymous = excluded.is_anonymous,
        avatar = excluded.avatar,
        avatar_mime = excluded.avatar_mime,
        updated_at = excluded.updated_at`,
    args: [
      user.id,
      user.account,
      passwordHash,
      user.name,
      user.bio,
      user.birthday,
      user.isAnonymous,
      avatar,
      avatarMime,
      now,
      now
    ]
  });
}

const blessingRows = [
  {
    id: "demo-blessing-current-1",
    sender: "demo-yuan",
    recipient: "demo-xiaoman",
    kind: "wish",
    year: currentYear,
    createdAt: now,
    respondedAt: null
  },
  {
    id: "demo-blessing-current-2",
    sender: "demo-acheng",
    recipient: "demo-xiaoman",
    kind: "wish",
    year: currentYear,
    createdAt: now,
    respondedAt: null
  },
  {
    id: "demo-blessing-past-1",
    sender: "demo-zhiyao",
    recipient: "demo-xiaoman",
    kind: "wish",
    year: currentYear - 1,
    createdAt: previousYearDate,
    respondedAt: previousYearDate
  },
  {
    id: "demo-blessing-share-1",
    sender: "demo-yuan",
    recipient: "demo-xiaoman",
    kind: "cake_share",
    year: currentYear,
    createdAt: now,
    respondedAt: null
  },
  {
    id: "demo-blessing-yuan-1",
    sender: "demo-xiaoman",
    recipient: "demo-yuan",
    kind: "wish",
    year: currentYear,
    createdAt: now,
    respondedAt: now
  }
];

for (const blessing of blessingRows) {
  await db.execute({
    sql: `INSERT INTO blessings
      (id, sender_id, recipient_id, kind, year, created_at, responded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      blessing.id,
      blessing.sender,
      blessing.recipient,
      blessing.kind,
      blessing.year,
      blessing.createdAt,
      blessing.respondedAt
    ]
  });
}

const total = await db.execute("SELECT COUNT(*) AS count FROM users");
console.log(`\nBirtHappy 演示数据已准备好（${Number(total.rows[0].count)} 位用户）。\n`);
console.log("今日生日：林小满、周予安、阿澄（阿澄匿名、无头像、简介为空）");
console.log("演示账号：xiaoman / yuan / acheng / zhiyao / nan");
console.log("统一密码：birthhappy123");
console.log("林小满有 4 份历史祝福，其中 2 份待回应，可体验切蛋糕。\n");
console.log(`数据库：${url}\n`);
