import type { Client, Row, Transaction } from "@libsql/client";
import { getDatabase } from "@/lib/db";
import {
  getMonthKey,
  getToday,
  getYear,
  type Today
} from "@/lib/birthday";
import { normalizeEmail } from "@/lib/email";
import { generateUid } from "@/lib/uid";
import { isValidUid, normalizeUid } from "@/lib/uid-rules";
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
export const DAILY_REGISTRATION_LIMIT = 100;
export const REGISTRATION_IP_DAILY_LIMIT = 5;
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

export class RegistrationError extends Error {
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
    this.name = "RegistrationError";
    this.status = options.status;
    this.code = options.code;
    this.fields = options.fields;
    this.details = options.details;
  }
}

const USER_COLUMNS = `
  id,
  account,
  email,
  email_verified_at,
  uid,
  uid_change_count,
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
    email: row.email == null ? null : String(row.email),
    emailVerifiedAt:
      row.email_verified_at == null ? null : String(row.email_verified_at),
    uid: String(row.uid ?? ""),
    uidChangeCount: Number(row.uid_change_count ?? 0),
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

export async function getUserCount(): Promise<number> {
  const db = await getDatabase();
  const result = await db.execute("SELECT COUNT(*) AS count FROM users");
  return Number(result.rows[0]?.count ?? 0);
}

export async function getUserByEmail(
  email: string
): Promise<(User & { passwordHash: string }) | null> {
  const db = await getDatabase();
  const result = await db.execute({
    sql: `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = ? LIMIT 1`,
    args: [normalizeEmail(email)]
  });
  const row = result.rows[0];
  if (!row) return null;
  return { ...toUser(row), passwordHash: String(row.password_hash) };
}

async function getUserWithPasswordByIdentifier(
  identifier: string
): Promise<(User & { passwordHash: string }) | null> {
  const db = await getDatabase();
  const normalized = identifier.trim();
  let result;

  if (normalized.includes("@")) {
    result = await db.execute({
      sql: `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = ? LIMIT 1`,
      args: [normalizeEmail(normalized)]
    });
  } else {
    result = await db.execute({
      sql: `SELECT ${USER_COLUMNS}, password_hash FROM users WHERE uid = ? LIMIT 1`,
      args: [normalizeUid(normalized)]
    });

    if (result.rows.length === 0) {
      // 过渡期兼容：仅允许尚未绑定邮箱的旧账号使用原账号名登录。
      result = await db.execute({
        sql: `SELECT ${USER_COLUMNS}, password_hash FROM users
          WHERE account = ? COLLATE NOCASE AND email IS NULL LIMIT 1`,
        args: [normalized]
      });
    }
  }

  const row = result.rows[0];
  if (!row) return null;
  return { ...toUser(row), passwordHash: String(row.password_hash) };
}

export async function getUserForLogin(identifier: string) {
  return getUserWithPasswordByIdentifier(identifier);
}

export async function isEmailTaken(email: string, excludeUserId?: string) {
  const db = await getDatabase();
  const normalized = normalizeEmail(email);
  const result = excludeUserId
    ? await db.execute({
        sql: "SELECT 1 FROM users WHERE email = ? AND id <> ? LIMIT 1",
        args: [normalized, excludeUserId]
      })
    : await db.execute({
        sql: "SELECT 1 FROM users WHERE email = ? LIMIT 1",
        args: [normalized]
      });
  return result.rows.length > 0;
}

export async function getDailyRegistrationUsed(day = getToday().iso) {
  const db = await getDatabase();
  const result = await db.execute({
    sql: "SELECT used FROM daily_registration_counters WHERE day = ? LIMIT 1",
    args: [day]
  });
  return Number(result.rows[0]?.used ?? 0);
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

export async function registerUser(input: {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  birthday: string;
  ipHash: string;
  codeId: string;
}): Promise<User> {
  const db = await getDatabase();
  const email = normalizeEmail(input.email);
  const now = new Date();
  const nowIso = now.toISOString();
  const monthKey = getMonthKey(now);
  const day = getToday().iso;
  const transaction = await db.transaction("write");

  try {
    const emailConflict = await transaction.execute({
      sql: "SELECT 1 FROM users WHERE email = ? LIMIT 1",
      args: [email]
    });
    if (emailConflict.rows.length > 0) {
      throw new RegistrationError("这个邮箱已经注册过了", {
        status: 409,
        code: "EMAIL_TAKEN",
        fields: { email: "这个邮箱已经注册过了" }
      });
    }

    await transaction.execute({
      sql: `INSERT OR IGNORE INTO daily_registration_counters (day, used)
        VALUES (?, 0)`,
      args: [day]
    });
    const slot = await transaction.execute({
      sql: `UPDATE daily_registration_counters
        SET used = used + 1
        WHERE day = ? AND used < ?`,
      args: [day, DAILY_REGISTRATION_LIMIT]
    });
    if (Number(slot.rowsAffected) === 0) {
      throw new RegistrationError("今日注册名额已满，请明天再试", {
        status: 429,
        code: "DAILY_REGISTRATION_LIMIT_REACHED",
        details: { dailyLimit: DAILY_REGISTRATION_LIMIT }
      });
    }

    const ipCount = await transaction.execute({
      sql: `SELECT COUNT(*) AS count FROM registration_events
        WHERE ip_hash = ? AND day = ?`,
      args: [input.ipHash, day]
    });
    if (Number(ipCount.rows[0]?.count ?? 0) >= REGISTRATION_IP_DAILY_LIMIT) {
      throw new RegistrationError(
        "当前网络今日注册次数过多，请明天再试或更换网络",
        {
          status: 429,
          code: "IP_REGISTRATION_LIMIT_REACHED",
          details: { ipDailyLimit: REGISTRATION_IP_DAILY_LIMIT }
        }
      );
    }

    const consumed = await transaction.execute({
      sql: `UPDATE email_codes
        SET consumed_at = ?
        WHERE id = ? AND purpose = 'register' AND email = ?
          AND consumed_at IS NULL AND expires_at > ?`,
      args: [nowIso, input.codeId, email, nowIso]
    });
    if (Number(consumed.rowsAffected) === 0) {
      throw new RegistrationError("验证码已失效，请重新获取", {
        status: 422,
        code: "EMAIL_CODE_INVALID",
        fields: { code: "验证码已失效，请重新获取" }
      });
    }

    let uid = generateUid();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const conflict = await transaction.execute({
        sql: "SELECT 1 FROM users WHERE uid = ? OR account = ? COLLATE NOCASE LIMIT 1",
        args: [uid, uid]
      });
      if (conflict.rows.length === 0) break;
      uid = generateUid();
    }

    const account = `mail:${email}`;
    await transaction.execute({
      sql: `INSERT INTO users
        (id, account, password_hash, name, bio, birthday, is_anonymous,
         email, email_verified_at, uid, uid_change_count, created_at, updated_at)
        VALUES (?, ?, ?, ?, '', ?, 0, ?, ?, ?, 0, ?, ?)`,
      args: [
        input.id,
        account,
        input.passwordHash,
        input.name,
        input.birthday,
        email,
        nowIso,
        uid,
        nowIso,
        nowIso
      ]
    });

    await transaction.batch([
      {
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
      },
      {
        sql: `INSERT INTO registration_events
          (id, user_id, email, ip_hash, day, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
        args: [
          crypto.randomUUID(),
          input.id,
          email,
          input.ipHash,
          day,
          nowIso
        ]
      }
    ]);

    await transaction.commit();

    return {
      id: input.id,
      account,
      email,
      emailVerifiedAt: nowIso,
      uid,
      uidChangeCount: 0,
      name: input.name,
      bio: "",
      birthday: input.birthday,
      isAnonymous: false,
      hasAvatar: false,
      createdAt: nowIso,
      updatedAt: nowIso
    };
  } catch (error) {
    await transaction.rollback();
    if (
      error instanceof Error &&
      /UNIQUE|SQLITE_CONSTRAINT/i.test(error.message)
    ) {
      throw new RegistrationError("邮箱或 UID 已被占用，请重试", {
        status: 409,
        code: "ACCOUNT_CONFLICT"
      });
    }
    throw error;
  } finally {
    transaction.close();
  }
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

export async function updateUid(
  userId: string,
  requestedUid: string
): Promise<{ user: User; changed: boolean }> {
  const uid = normalizeUid(requestedUid);
  if (!isValidUid(uid)) {
    throw new ProfileChangeError(
      "UID 格式不正确，需为 6–16 位字母、数字或下划线",
      {
        status: 422,
        code: "INVALID_UID",
        fields: { uid: "UID 格式不正确" }
      }
    );
  }

  const db = await getDatabase();
  const transaction = await db.transaction("write");
  try {
    const user = await findUserById(transaction, userId);
    if (!user) {
      throw new ProfileChangeError("没有找到你的资料", {
        status: 404,
        code: "USER_NOT_FOUND"
      });
    }
    if (user.uid === uid) {
      return { user, changed: false };
    }
    if (user.uidChangeCount >= 1) {
      throw new ProfileChangeError("UID 只能修改 1 次，你已经使用过这次机会。", {
        status: 429,
        code: "UID_CHANGE_LIMIT_REACHED",
        fields: { uid: "UID 修改机会已用完" }
      });
    }

    const conflict = await transaction.execute({
      sql: `SELECT 1 FROM users
        WHERE id <> ? AND (uid = ? OR account = ? COLLATE NOCASE)
        LIMIT 1`,
      args: [userId, uid, uid]
    });
    if (conflict.rows.length > 0) {
      throw new ProfileChangeError("这个 UID 已经被占用，请换一个", {
        status: 409,
        code: "UID_TAKEN",
        fields: { uid: "这个 UID 已经被占用" }
      });
    }

    const nowIso = new Date().toISOString();
    const updated = await transaction.execute({
      sql: `UPDATE users
        SET uid = ?, uid_change_count = uid_change_count + 1, updated_at = ?
        WHERE id = ? AND uid_change_count < 1`,
      args: [uid, nowIso, userId]
    });
    if (Number(updated.rowsAffected) === 0) {
      throw new ProfileChangeError("UID 修改机会已用完", {
        status: 429,
        code: "UID_CHANGE_LIMIT_REACHED"
      });
    }

    const updatedUser = await findUserById(transaction, userId);
    await transaction.commit();
    if (!updatedUser) throw new Error("更新 UID 后未找到用户");
    return { user: updatedUser, changed: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}

export async function bindUserEmail(
  userId: string,
  requestedEmail: string,
  codeId: string
): Promise<User> {
  const email = normalizeEmail(requestedEmail);
  const db = await getDatabase();
  const transaction = await db.transaction("write");
  try {
    const user = await findUserById(transaction, userId);
    if (!user) {
      throw new ProfileChangeError("没有找到你的资料", {
        status: 404,
        code: "USER_NOT_FOUND"
      });
    }
    if (user.email) {
      throw new ProfileChangeError("这个账号已经绑定邮箱", {
        status: 409,
        code: "EMAIL_ALREADY_BOUND"
      });
    }
    const conflict = await transaction.execute({
      sql: "SELECT 1 FROM users WHERE email = ? AND id <> ? LIMIT 1",
      args: [email, userId]
    });
    if (conflict.rows.length > 0) {
      throw new ProfileChangeError("这个邮箱已经被使用", {
        status: 409,
        code: "EMAIL_TAKEN",
        fields: { email: "这个邮箱已经被使用" }
      });
    }

    const nowIso = new Date().toISOString();
    const consumed = await transaction.execute({
      sql: `UPDATE email_codes
        SET consumed_at = ?
        WHERE id = ? AND purpose = 'bind' AND user_id = ?
          AND email = ? AND consumed_at IS NULL AND expires_at > ?`,
      args: [nowIso, codeId, userId, email, nowIso]
    });
    if (Number(consumed.rowsAffected) === 0) {
      throw new ProfileChangeError("验证码已失效，请重新获取", {
        status: 422,
        code: "EMAIL_CODE_INVALID",
        fields: { code: "验证码已失效，请重新获取" }
      });
    }

    await transaction.execute({
      sql: `UPDATE users
        SET email = ?, email_verified_at = ?, updated_at = ?
        WHERE id = ?`,
      args: [email, nowIso, nowIso, userId]
    });
    const updatedUser = await findUserById(transaction, userId);
    await transaction.commit();
    if (!updatedUser) throw new Error("绑定邮箱后未找到用户");
    return updatedUser;
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }
}

export async function deleteUserAccount(
  userId: string,
  codeId: string
): Promise<boolean> {
  const db = await getDatabase();
  const transaction = await db.transaction("write");
  try {
    const user = await findUserById(transaction, userId);
    if (!user) {
      throw new ProfileChangeError("没有找到你的资料", {
        status: 404,
        code: "USER_NOT_FOUND"
      });
    }
    if (!user.email) {
      throw new ProfileChangeError("请先绑定邮箱再注销账号", {
        status: 409,
        code: "EMAIL_REQUIRED"
      });
    }

    const nowIso = new Date().toISOString();
    const consumed = await transaction.execute({
      sql: `UPDATE email_codes
        SET consumed_at = ?
        WHERE id = ? AND purpose = 'delete' AND user_id = ?
          AND email = ? AND consumed_at IS NULL AND expires_at > ?`,
      args: [nowIso, codeId, userId, user.email, nowIso]
    });
    if (Number(consumed.rowsAffected) === 0) {
      throw new ProfileChangeError("验证码已失效，请重新获取", {
        status: 422,
        code: "EMAIL_CODE_INVALID",
        fields: { code: "验证码已失效，请重新获取" }
      });
    }

    await transaction.batch([
      {
        sql: "DELETE FROM cake_cuts WHERE user_id = ?",
        args: [userId]
      },
      {
        sql: "DELETE FROM blessings WHERE sender_id = ? OR recipient_id = ?",
        args: [userId, userId]
      },
      {
        sql: "DELETE FROM change_quotas WHERE user_id = ?",
        args: [userId]
      },
      {
        sql: "DELETE FROM registration_events WHERE user_id = ? OR email = ?",
        args: [userId, user.email]
      },
      {
        sql: "DELETE FROM email_codes WHERE user_id = ? OR email = ?",
        args: [userId, user.email]
      },
      {
        sql: "DELETE FROM users WHERE id = ?",
        args: [userId]
      }
    ]);
    await transaction.commit();
    return true;
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
