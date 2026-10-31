import type { Row } from "@libsql/client";
import { getDatabase } from "@/lib/db";
import { getYear, type Today } from "@/lib/birthday";
import type {
  BlessingStats,
  BirthdayPerson,
  User,
  YearBlessingStat
} from "@/lib/types";

const USER_COLUMNS = `
  id,
  account,
  name,
  bio,
  birthday,
  is_anonymous,
  CASE WHEN avatar IS NULL OR avatar_mime IS NULL THEN 0 ELSE 1 END AS has_avatar,
  created_at,
  updated_at
`;

function toUser(row: Row): User {
  return {
    id: String(row.id),
    account: String(row.account),
    name: String(row.name),
    bio: String(row.bio ?? ""),
    birthday: String(row.birthday),
    isAnonymous: Number(row.is_anonymous) === 1,
    hasAvatar: Number(row.has_avatar) === 1,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await getDatabase();
  const result = await db.execute({
    sql: `SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    args: [id]
  });
  return result.rows[0] ? toUser(result.rows[0]) : null;
}

export async function getUserByAccount(account: string): Promise<
  (User & { passwordHash: string }) | null
> {
  const db = await getDatabase();
  const result = await db.execute({
    sql: `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE account = ? COLLATE NOCASE LIMIT 1`,
    args: [account]
  });
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...toUser(row),
    passwordHash: String(row.password_hash)
  };
}

export async function accountExists(account: string): Promise<boolean> {
  const db = await getDatabase();
  const result = await db.execute({
    sql: "SELECT 1 AS found FROM users WHERE account = ? COLLATE NOCASE LIMIT 1",
    args: [account]
  });
  return result.rows.length > 0;
}

export async function createUser(input: {
  id: string;
  account: string;
  passwordHash: string;
  name: string;
  birthday: string;
  isAnonymous?: boolean;
}): Promise<User> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO users
      (id, account, password_hash, name, bio, birthday, is_anonymous, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', ?, ?, ?, ?)`,
    args: [
      input.id,
      input.account,
      input.passwordHash,
      input.name,
      input.birthday,
      input.isAnonymous ? 1 : 0,
      now,
      now
    ]
  });

  const user = await getUserById(input.id);
  if (!user) throw new Error("创建账号后未能读取用户资料");
  return user;
}

export async function getTodayBirthdayPeople(
  viewerId: string | null,
  today: Today
): Promise<BirthdayPerson[]> {
  const db = await getDatabase();
  const result = await db.execute({
    sql: `SELECT
        u.id,
        u.name,
        u.bio,
        u.is_anonymous,
        CASE WHEN u.avatar IS NULL OR u.avatar_mime IS NULL THEN 0 ELSE 1 END AS has_avatar,
        u.updated_at,
        CASE WHEN b.id IS NULL THEN 0 ELSE 1 END AS has_wished
      FROM users u
      LEFT JOIN blessings b
        ON b.recipient_id = u.id
        AND b.sender_id = ?
        AND b.kind = 'wish'
        AND b.year = ?
      WHERE u.id <> ?
        AND (
          substr(u.birthday, 6, 5) = ?
          OR (
            u.birthday LIKE '%-02-29'
            AND ? = '02-28'
            AND ? = 0
          )
        )
      ORDER BY u.created_at ASC, u.id ASC`,
    args: [
      viewerId ?? "",
      getYear(),
      viewerId ?? "",
      today.monthDay,
      today.monthDay,
      today.isLeapYear ? 1 : 0
    ]
  });

  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    bio: String(row.bio ?? ""),
    isAnonymous: Number(row.is_anonymous) === 1,
    hasAvatar: Number(row.has_avatar) === 1,
    updatedAt: String(row.updated_at),
    hasWished: Number(row.has_wished) === 1
  }));
}

export async function updateUserProfile(
  userId: string,
  input: {
    name: string;
    bio: string;
    birthday: string;
    isAnonymous: boolean;
  },
  avatar:
    | { action: "keep" }
    | { action: "remove" }
    | { action: "replace"; bytes: Uint8Array; mime: string }
): Promise<User | null> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const columns = [
    "name = ?",
    "bio = ?",
    "birthday = ?",
    "is_anonymous = ?",
    "updated_at = ?"
  ];
  const args: (string | number | Uint8Array | null)[] = [
    input.name,
    input.bio,
    input.birthday,
    input.isAnonymous ? 1 : 0,
    now
  ];

  if (avatar.action === "replace") {
    columns.push("avatar = ?", "avatar_mime = ?");
    args.push(avatar.bytes, avatar.mime);
  } else if (avatar.action === "remove") {
    columns.push("avatar = NULL", "avatar_mime = NULL");
  }

  args.push(userId);
  await db.execute({
    sql: `UPDATE users SET ${columns.join(", ")} WHERE id = ?`,
    args
  });

  return getUserById(userId);
}

export async function getAvatar(
  userId: string
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const db = await getDatabase();
  const result = await db.execute({
    sql: "SELECT avatar, avatar_mime FROM users WHERE id = ? LIMIT 1",
    args: [userId]
  });
  const row = result.rows[0];
  if (!row || !row.avatar || !row.avatar_mime) return null;

  const value = row.avatar;
  if (!(value instanceof ArrayBuffer)) return null;
  const bytes = new Uint8Array(value);
  if (bytes.byteLength === 0) return null;
  return { bytes, mime: String(row.avatar_mime) };
}

export async function createWish(
  senderId: string,
  recipientId: string
): Promise<boolean> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT OR IGNORE INTO blessings
      (id, sender_id, recipient_id, kind, year, created_at, responded_at)
      VALUES (?, ?, ?, 'wish', ?, ?, NULL)`,
    args: [
      crypto.randomUUID(),
      senderId,
      recipientId,
      getYear(),
      now
    ]
  });
  return Number(result.rowsAffected) > 0;
}

export async function getPendingWishCount(userId: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute({
    sql: `SELECT COUNT(*) AS pending
      FROM blessings
      WHERE recipient_id = ? AND kind = 'wish' AND responded_at IS NULL`,
    args: [userId]
  });
  return Number(result.rows[0]?.pending ?? 0);
}

export async function cutCake(userId: string): Promise<{
  responded: number;
  shared: number;
}> {
  const db = await getDatabase();
  const pending = await db.execute({
    sql: `SELECT id, sender_id
      FROM blessings
      WHERE recipient_id = ? AND kind = 'wish' AND responded_at IS NULL
      ORDER BY created_at ASC
      LIMIT 500`,
    args: [userId]
  });

  if (pending.rows.length === 0) {
    return { responded: 0, shared: 0 };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const year = getYear(now);
  const wishIds = pending.rows.map((row) => String(row.id));
  const statements = pending.rows.map((row) => ({
    sql: `INSERT OR IGNORE INTO blessings
      (id, sender_id, recipient_id, kind, year, created_at, responded_at)
      VALUES (?, ?, ?, 'cake_share', ?, ?, NULL)`,
    args: [
      crypto.randomUUID(),
      userId,
      String(row.sender_id),
      year,
      nowIso
    ]
  }));
  const placeholders = wishIds.map(() => "?").join(", ");
  statements.push({
    sql: `UPDATE blessings SET responded_at = ?
      WHERE id IN (${placeholders}) AND responded_at IS NULL`,
    args: [nowIso, ...wishIds]
  });

  const results = await db.batch(statements, "write");
  let shared = 0;
  for (let index = 0; index < pending.rows.length; index += 1) {
    shared += Number(results[index]?.rowsAffected ?? 0);
  }
  const responded = Number(
    results[results.length - 1]?.rowsAffected ?? pending.rows.length
  );

  if (responded > 0) {
    await db.execute({
      sql: `INSERT INTO cake_cuts
        (id, user_id, wish_count, share_count, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), userId, responded, shared, nowIso]
    });
  }

  return { responded, shared };
}

export async function getBlessingStats(
  userId: string
): Promise<BlessingStats> {
  const db = await getDatabase();
  const result = await db.execute({
    sql: `SELECT
        year,
        COUNT(*) AS total,
        SUM(CASE WHEN kind = 'wish' THEN 1 ELSE 0 END) AS wishes,
        SUM(CASE WHEN kind = 'cake_share' THEN 1 ELSE 0 END) AS shares
      FROM blessings
      WHERE recipient_id = ?
      GROUP BY year
      ORDER BY year DESC`,
    args: [userId]
  });

  const years: YearBlessingStat[] = result.rows.map((row) => ({
    year: Number(row.year),
    total: Number(row.total ?? 0),
    wishes: Number(row.wishes ?? 0),
    shares: Number(row.shares ?? 0)
  }));

  return {
    total: years.reduce((sum, item) => sum + item.total, 0),
    wishes: years.reduce((sum, item) => sum + item.wishes, 0),
    shares: years.reduce((sum, item) => sum + item.shares, 0),
    years
  };
}
