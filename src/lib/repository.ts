import type { Client, Row, Transaction } from "@libsql/client";
import { getDatabase } from "@/lib/db";
import { getMonthKey, getYear, type Today } from "@/lib/birthday";
import type {
  BlessingStats,
  BirthdayPerson,
  ChangeQuotaState,
  ProfileSaveResult,
  User,
  YearBlessingStat
} from "@/lib/types";

export const PROFILE_CHANGE_LIMIT = 3;
export const BIRTHDAY_CHANGE_LIMIT = 3;
const BIRTHDAY_PERIOD = "lifetime";

type SqlExecutor = Client | Transaction;

export type AvatarChange =
  | { action: "keep" }
  | { action: "remove" }
  | { action: "replace"; bytes: Uint8Array; mime: string };

export class ProfileChangeError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      status: number;
      code: string;
      fields?: Record<string, string>;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "ProfileChangeError";
    this.status = options.status;
    this.code = options.code;
    this.fields = options.fields;
    this.details = options.details;
  }
}

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

async function findUserById(
  executor: SqlExecutor,
  id: string
): Promise<User | null> {
  const result = await executor.execute({
    sql: `SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`,
    args: [id]
  });
  return result.rows[0] ? toUser(result.rows[0]) : null;
}

export async function getUserById(id: string): Promise<User | null> {
  const db = await getDatabase();
  return findUserById(db, id);
}

function initialProfileUsage(createdAt: string, monthKey: string) {
  return getMonthKey(new Date(createdAt)) === monthKey ? 1 : 0;
}

async function ensureQuotaRows(
  executor: SqlExecutor,
  user: User,
  monthKey: string,
  nowIso: string
) {
  await executor.execute({
    sql: `INSERT OR IGNORE INTO change_quotas
      (user_id, kind, period, used, updated_at)
      VALUES (?, 'profile', ?, ?, ?)`,
    args: [
      user.id,
      monthKey,
      initialProfileUsage(user.createdAt, monthKey),
      nowIso
    ]
  });
  await executor.execute({
    sql: `INSERT OR IGNORE INTO change_quotas
      (user_id, kind, period, used, updated_at)
      VALUES (?, 'birthday', 'lifetime', 0, ?)`,
    args: [user.id, nowIso]
  });
}

async function readQuotaState(
  executor: SqlExecutor,
  userId: string,
  monthKey: string
): Promise<ChangeQuotaState> {
  const result = await executor.execute({
    sql: `SELECT kind, used
      FROM change_quotas
      WHERE user_id = ?
        AND (
          (kind = 'profile' AND period = ?)
          OR (kind = 'birthday' AND period = 'lifetime')
        )`,
    args: [userId, monthKey]
  });

  let profileUsed = 0;
  let birthdayUsed = 0;
  for (const row of result.rows) {
    if (row.kind === "profile") profileUsed = Number(row.used);
    if (row.kind === "birthday") birthdayUsed = Number(row.used);
  }

  return {
    profile: {
      used: profileUsed,
      remaining: Math.max(0, PROFILE_CHANGE_LIMIT - profileUsed),
      limit: PROFILE_CHANGE_LIMIT,
      period: monthKey
    },
    birthday: {
      used: birthdayUsed,
      remaining: Math.max(0, BIRTHDAY_CHANGE_LIMIT - birthdayUsed),
      limit: BIRTHDAY_CHANGE_LIMIT
    }
  };
}

export async function getChangeQuotaState(
  user: User
): Promise<ChangeQuotaState> {
  const db = await getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const monthKey = getMonthKey(now);
  await ensureQuotaRows(db, user, monthKey, nowIso);
  return readQuotaState(db, user.id, monthKey);
}

async function countReceivedWishes(
  executor: SqlExecutor,
  userId: string
) {
  const result = await executor.execute({
    sql: `SELECT COUNT(*) AS count
      FROM blessings
      WHERE recipient_id = ? AND kind = 'wish'`,
    args: [userId]
  });
  return Number(result.rows[0]?.count ?? 0);
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
  const now = new Date();
  const nowIso = now.toISOString();
  const monthKey = getMonthKey(now);

  await db.batch(
    [
      {
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
          nowIso,
          nowIso
        ]
      },
      {
        // 注册本身计为当月第 1 次资料修改。
        sql: `INSERT INTO change_quotas
          (user_id, kind, period, used, updated_at)
          VALUES (?, 'profile', ?, 1, ?)`,
        args: [input.id, monthKey, nowIso]
      },
      {
        sql: `INSERT INTO change_quotas
          (user_id, kind, period, used, updated_at)
          VALUES (?, 'birthday', 'lifetime', 0, ?)`,
        args: [input.id, nowIso]
      }
    ],
    "write"
  );

  const user = await getUserById(input.id);
  if (!user) throw new Error("创建账号后未能读取用户资料");
  return user;
}

export async function getTodayBirthdayPeople(
  viewerId: string | null,
  today: Today
): Promise<BirthdayPerson[]> {
  const db = await getDatabase();
  const monthDays = [today.monthDay];

  // 2 月 29 日出生的人，在非闰年的 2 月 28 日一起庆祝。
  if (today.monthDay === "02-28" && !today.isLeapYear) {
    monthDays.push("02-29");
  }
  const monthDayPlaceholders = monthDays.map(() => "?").join(", ");

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
        AND substr(u.birthday, 6, 5) IN (${monthDayPlaceholders})
      ORDER BY u.created_at ASC, u.id ASC`,
    args: [
      viewerId ?? "",
      getYear(),
      viewerId ?? "",
      ...monthDays
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

function profileChangedFor(user: User, input: {
  name: string;
  bio: string;
  avatar: AvatarChange;
}) {
  return (
    user.name !== input.name ||
    user.bio !== input.bio ||
    input.avatar.action === "replace" ||
    (input.avatar.action === "remove" && user.hasAvatar)
  );
}

function profileLimitError(quota: ChangeQuotaState) {
  return new ProfileChangeError(
    "本月头像、称呼和简介的 3 次修改机会已用完，下月 1 日恢复。",
    {
      status: 429,
      code: "PROFILE_MONTHLY_LIMIT_REACHED",
      fields: {
        profile: "本月资料修改次数已用完"
      },
      details: { quota }
    }
  );
}

function birthdayLimitError(quota: ChangeQuotaState) {
  return new ProfileChangeError(
    "这个账号的 3 次生日修改机会已经全部用完，生日不能再修改。",
    {
      status: 429,
      code: "BIRTHDAY_LIMIT_REACHED",
      fields: {
        birthday: "生日修改次数已用完"
      },
      details: { quota }
    }
  );
}

export async function saveUserProfile(
  userId: string,
  input: {
    name: string;
    bio: string;
    birthday: string;
    isAnonymous: boolean;
    avatar: AvatarChange;
  },
  confirmBirthdayReset: boolean
): Promise<ProfileSaveResult> {
  const db = await getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const monthKey = getMonthKey(now);

  const current = await findUserById(db, userId);
  if (!current) {
    throw new ProfileChangeError("没有找到你的资料", {
      status: 404,
      code: "USER_NOT_FOUND"
    });
  }

  const quotaBefore = await getChangeQuotaState(current);
  const initialProfileChanged = profileChangedFor(current, input);
  const initialBirthdayChanged = current.birthday !== input.birthday;
  const initialAnonymousChanged = current.isAnonymous !== input.isAnonymous;

  if (
    !initialProfileChanged &&
    !initialBirthdayChanged &&
    !initialAnonymousChanged
  ) {
    return {
      user: current,
      quota: quotaBefore,
      profileChanged: false,
      birthdayChanged: false,
      removedWishCount: 0
    };
  }

  if (initialProfileChanged && quotaBefore.profile.remaining <= 0) {
    throw profileLimitError(quotaBefore);
  }
  if (initialBirthdayChanged && quotaBefore.birthday.remaining <= 0) {
    throw birthdayLimitError(quotaBefore);
  }
  if (initialBirthdayChanged && !confirmBirthdayReset) {
    const removedWishCount = await countReceivedWishes(db, userId);
    throw new ProfileChangeError(
      "修改生日会清空已收到的生日祝福，请确认后再保存。",
      {
        status: 409,
        code: "BIRTHDAY_CONFIRMATION_REQUIRED",
        details: {
          quota: quotaBefore,
          oldBirthday: current.birthday,
          newBirthday: input.birthday,
          removedWishCount
        }
      }
    );
  }

  const transaction = await db.transaction("write");
  try {
    const latest = await findUserById(transaction, userId);
    if (!latest) {
      throw new ProfileChangeError("没有找到你的资料", {
        status: 404,
        code: "USER_NOT_FOUND"
      });
    }

    await ensureQuotaRows(transaction, latest, monthKey, nowIso);
    let quota = await readQuotaState(transaction, userId, monthKey);

    const profileChanged = profileChangedFor(latest, input);
    const birthdayChanged = latest.birthday !== input.birthday;
    const anonymousChanged = latest.isAnonymous !== input.isAnonymous;

    if (profileChanged && quota.profile.remaining <= 0) {
      throw profileLimitError(quota);
    }
    if (birthdayChanged && quota.birthday.remaining <= 0) {
      throw birthdayLimitError(quota);
    }
    if (birthdayChanged && !confirmBirthdayReset) {
      const removedWishCount = await countReceivedWishes(
        transaction,
        userId
      );
      throw new ProfileChangeError(
        "修改生日会清空已收到的生日祝福，请确认后再保存。",
        {
          status: 409,
          code: "BIRTHDAY_CONFIRMATION_REQUIRED",
          details: {
            quota,
            oldBirthday: latest.birthday,
            newBirthday: input.birthday,
            removedWishCount
          }
        }
      );
    }

    const removedWishCount = birthdayChanged
      ? await countReceivedWishes(transaction, userId)
      : 0;

    if (profileChanged) {
      const reserved = await transaction.execute({
        sql: `UPDATE change_quotas
          SET used = used + 1, updated_at = ?
          WHERE user_id = ? AND kind = 'profile' AND period = ? AND used < ?`,
        args: [nowIso, userId, monthKey, PROFILE_CHANGE_LIMIT]
      });
      if (Number(reserved.rowsAffected) === 0) {
        throw profileLimitError(quota);
      }
    }

    if (birthdayChanged) {
      const reserved = await transaction.execute({
        sql: `UPDATE change_quotas
          SET used = used + 1, updated_at = ?
          WHERE user_id = ? AND kind = 'birthday' AND period = 'lifetime' AND used < ?`,
        args: [nowIso, userId, BIRTHDAY_CHANGE_LIMIT]
      });
      if (Number(reserved.rowsAffected) === 0) {
        throw birthdayLimitError(quota);
      }
    }

    if (profileChanged || birthdayChanged || anonymousChanged) {
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
        nowIso
      ];

      if (input.avatar.action === "replace") {
        columns.push("avatar = ?", "avatar_mime = ?");
        args.push(input.avatar.bytes, input.avatar.mime);
      } else if (input.avatar.action === "remove") {
        columns.push("avatar = NULL", "avatar_mime = NULL");
      }

      args.push(userId);
      await transaction.execute({
        sql: `UPDATE users SET ${columns.join(", ")} WHERE id = ?`,
        args
      });
    }

    if (birthdayChanged) {
      await transaction.execute({
        sql: `DELETE FROM blessings
          WHERE recipient_id = ? AND kind = 'wish'`,
        args: [userId]
      });
    }

    quota = await readQuotaState(transaction, userId, monthKey);
    await transaction.commit();

    const updatedUser: User = {
      ...latest,
      name: input.name,
      bio: input.bio,
      birthday: input.birthday,
      isAnonymous: input.isAnonymous,
      hasAvatar:
        input.avatar.action === "remove"
          ? false
          : input.avatar.action === "replace"
            ? true
            : latest.hasAvatar,
      updatedAt: nowIso
    };

    return {
      user: updatedUser,
      quota,
      profileChanged,
      birthdayChanged,
      removedWishCount
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
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
