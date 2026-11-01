import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { getDatabase } from "@/lib/db";
import { getToday } from "@/lib/birthday";
import { normalizeEmail } from "@/lib/email";
import { getAuthSecret } from "@/lib/secrets";

export type EmailCodePurpose = "register" | "bind" | "delete";

export class EmailCodeError extends Error {
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
    this.name = "EmailCodeError";
    this.status = options.status;
    this.code = options.code;
    this.fields = options.fields;
    this.details = options.details;
  }
}

const CODE_TTL_MS = 10 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const EMAIL_HOUR_LIMIT = 5;
const EMAIL_DAY_LIMIT = 10;
const IP_HOUR_LIMIT = 20;
const IP_DAY_LIMIT = 50;
const GLOBAL_DAILY_EMAIL_LIMIT = 500;
const MAX_ATTEMPTS = 5;

function dayStartIso() {
  return new Date(`${getToday().iso}T00:00:00+08:00`).toISOString();
}

function hourAgoIso() {
  return new Date(Date.now() - 60 * 60 * 1000).toISOString();
}

function hashCode(email: string, purpose: EmailCodePurpose, code: string) {
  return createHmac("sha256", getAuthSecret())
    .update(`birthappy-email-code:${purpose}:${email}:${code}`)
    .digest("hex");
}

function codesMatch(providedHash: string, expectedHash: string) {
  const a = Buffer.from(providedHash);
  const b = Buffer.from(expectedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function issueEmailCode(input: {
  email: string;
  purpose: EmailCodePurpose;
  userId: string | null;
  ipHash: string;
}) {
  const db = await getDatabase();
  const email = normalizeEmail(input.email);
  const now = new Date();
  const nowIso = now.toISOString();
  const dayStart = dayStartIso();
  const hourAgo = hourAgoIso();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = hashCode(email, input.purpose, code);
  const id = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString();

  const transaction = await db.transaction("write");
  try {
    const lastSend = await transaction.execute({
      sql: `SELECT created_at FROM email_codes
        WHERE email = ?
        ORDER BY created_at DESC
        LIMIT 1`,
      args: [email]
    });
    if (lastSend.rows.length > 0) {
      const elapsed =
        now.getTime() - new Date(String(lastSend.rows[0].created_at)).getTime();
      if (elapsed < COOLDOWN_MS) {
        throw new EmailCodeError(
          `验证码发送过于频繁，请 ${Math.ceil((COOLDOWN_MS - elapsed) / 1000)} 秒后再试`,
          {
            status: 429,
            code: "EMAIL_CODE_COOLDOWN",
            details: {
              retryAfterSeconds: Math.ceil((COOLDOWN_MS - elapsed) / 1000)
            }
          }
        );
      }
    }

    const emailHour = await transaction.execute({
      sql: "SELECT COUNT(*) AS count FROM email_codes WHERE email = ? AND created_at >= ?",
      args: [email, hourAgo]
    });
    const emailDay = await transaction.execute({
      sql: "SELECT COUNT(*) AS count FROM email_codes WHERE email = ? AND created_at >= ?",
      args: [email, dayStart]
    });
    const ipHour = await transaction.execute({
      sql: "SELECT COUNT(*) AS count FROM email_codes WHERE ip_hash = ? AND created_at >= ?",
      args: [input.ipHash, hourAgo]
    });
    const ipDay = await transaction.execute({
      sql: "SELECT COUNT(*) AS count FROM email_codes WHERE ip_hash = ? AND created_at >= ?",
      args: [input.ipHash, dayStart]
    });
    const globalDay = await transaction.execute({
      sql: "SELECT COUNT(*) AS count FROM email_codes WHERE created_at >= ?",
      args: [dayStart]
    });

    if (
      Number(emailHour.rows[0]?.count ?? 0) >= EMAIL_HOUR_LIMIT ||
      Number(emailDay.rows[0]?.count ?? 0) >= EMAIL_DAY_LIMIT ||
      Number(ipHour.rows[0]?.count ?? 0) >= IP_HOUR_LIMIT ||
      Number(ipDay.rows[0]?.count ?? 0) >= IP_DAY_LIMIT ||
      Number(globalDay.rows[0]?.count ?? 0) >= GLOBAL_DAILY_EMAIL_LIMIT
    ) {
      throw new EmailCodeError("验证码请求过于频繁，请稍后再试", {
        status: 429,
        code: "EMAIL_CODE_RATE_LIMITED"
      });
    }

    await transaction.execute({
      sql: `UPDATE email_codes SET consumed_at = ?
        WHERE email = ? AND purpose = ? AND user_id IS ?
          AND consumed_at IS NULL`,
      args: [nowIso, email, input.purpose, input.userId]
    });
    await transaction.execute({
      sql: `INSERT INTO email_codes
        (id, email, user_id, purpose, code_hash, ip_hash, attempts,
         created_at, expires_at, consumed_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`,
      args: [
        id,
        email,
        input.userId,
        input.purpose,
        codeHash,
        input.ipHash,
        nowIso,
        expiresAt
      ]
    });
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    transaction.close();
  }

  return {
    id,
    code,
    email,
    expiresAt,
    cooldownSeconds: Math.ceil(COOLDOWN_MS / 1000)
  };
}

export async function verifyEmailCode(input: {
  email: string;
  purpose: EmailCodePurpose;
  userId: string | null;
  code: string;
}) {
  const db = await getDatabase();
  const email = normalizeEmail(input.email);
  const code = input.code.trim();
  const result = await db.execute({
    sql: `SELECT id, code_hash, expires_at, attempts
      FROM email_codes
      WHERE email = ? AND purpose = ? AND user_id IS ?
        AND consumed_at IS NULL AND attempts < ?
      ORDER BY created_at DESC
      LIMIT 1`,
    args: [email, input.purpose, input.userId, MAX_ATTEMPTS]
  });

  const row = result.rows[0];
  if (!row) {
    throw new EmailCodeError("验证码已失效，请重新获取", {
      status: 422,
      code: "EMAIL_CODE_INVALID",
      fields: { code: "验证码已失效，请重新获取" }
    });
  }

  if (new Date(String(row.expires_at)).getTime() <= Date.now()) {
    await db.execute({
      sql: "UPDATE email_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL",
      args: [new Date().toISOString(), String(row.id)]
    });
    throw new EmailCodeError("验证码已过期，请重新获取", {
      status: 422,
      code: "EMAIL_CODE_EXPIRED",
      fields: { code: "验证码已过期，请重新获取" }
    });
  }

  const expected = String(row.code_hash);
  const provided = hashCode(email, input.purpose, code);
  if (!codesMatch(provided, expected)) {
    const attempts = Number(row.attempts) + 1;
    await db.execute({
      sql: `UPDATE email_codes
        SET attempts = ?, consumed_at = CASE WHEN ? >= ? THEN ? ELSE consumed_at END
        WHERE id = ?`,
      args: [
        attempts,
        attempts,
        MAX_ATTEMPTS,
        new Date().toISOString(),
        String(row.id)
      ]
    });
    const remaining = Math.max(0, MAX_ATTEMPTS - attempts);
    throw new EmailCodeError(
      remaining > 0
        ? `验证码错误，还可以尝试 ${remaining} 次`
        : "验证码错误次数过多，请重新获取",
      {
        status: 422,
        code: "EMAIL_CODE_WRONG",
        fields: { code: "验证码错误" },
        details: { attemptsRemaining: remaining }
      }
    );
  }

  return {
    id: String(row.id),
    email,
    purpose: input.purpose
  };
}

export async function invalidateEmailCode(id: string) {
  const db = await getDatabase();
  await db.execute({
    sql: "UPDATE email_codes SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL",
    args: [new Date().toISOString(), id]
  });
}

export async function cleanupOldEmailCodes() {
  const db = await getDatabase();
  const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  await db.execute({
    sql: "DELETE FROM email_codes WHERE created_at < ?",
    args: [cutoff]
  });
}
