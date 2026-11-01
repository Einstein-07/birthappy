import {
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import { getAuthSecret } from "@/lib/secrets";

const FORM_TOKEN_MIN_AGE_MS = 2500;
const FORM_TOKEN_MAX_AGE_MS = 30 * 60 * 1000;

function sign(payload: string) {
  return createHmac("sha256", getAuthSecret())
    .update(`birthappy-form:${payload}`)
    .digest("base64url");
}

export function createFormToken(purpose: string) {
  const payload = Buffer.from(
    JSON.stringify({
      purpose,
      issuedAt: Date.now(),
      nonce: randomBytes(12).toString("base64url")
    })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyFormToken(token: string, purpose: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return { ok: false as const, reason: "验证令牌格式不正确" };
  }

  const expected = sign(payload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return { ok: false as const, reason: "验证令牌无效，请刷新页面后重试" };
  }

  try {
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { purpose?: string; issuedAt?: number };
    if (data.purpose !== purpose) {
      return { ok: false as const, reason: "验证令牌用途不匹配" };
    }
    const age = Date.now() - Number(data.issuedAt);
    if (!Number.isFinite(age) || age < FORM_TOKEN_MIN_AGE_MS) {
      return { ok: false as const, reason: "提交速度过快，请稍后再试" };
    }
    if (age > FORM_TOKEN_MAX_AGE_MS) {
      return { ok: false as const, reason: "页面停留时间过长，请刷新后重试" };
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: "验证令牌无法解析" };
  }
}
