import { getToday, isValidBirthday } from "@/lib/birthday";
import type { ApiFieldErrors } from "@/lib/types";

const MAX_AVATAR_BYTES = 512 * 1024;
const MAX_BODY_BYTES = 2_500_000;

export type AvatarPayload =
  | { action: "keep" }
  | { action: "remove" }
  | { action: "replace"; bytes: Uint8Array; mime: string };

export type RegisterValues = {
  account: string;
  password: string;
  name: string;
  birthday: string;
};

export type ProfileValues = {
  name: string;
  bio: string;
  birthday: string;
  isAnonymous: boolean;
  avatar: AvatarPayload;
};

type Failure = { ok: false; fields: ApiFieldErrors };
type Success<T> = { ok: true; value: T };

function characterCount(value: string) {
  return Array.from(value).length;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function validateRegisterInput(
  input: Record<string, unknown>
): Success<RegisterValues> | Failure {
  const account = asString(input.account).trim();
  const password = asString(input.password);
  const name = asString(input.name).trim();
  const birthday = asString(input.birthday).trim();
  const fields: ApiFieldErrors = {};

  if (!account) {
    fields.account = "请填写登录账号";
  } else if (!/^[A-Za-z0-9_]{3,24}$/.test(account)) {
    fields.account = "账号需为 3–24 位字母、数字或下划线";
  }

  if (password.length < 8) {
    fields.password = "密码至少需要 8 个字符";
  } else if (password.length > 72) {
    fields.password = "密码不能超过 72 个字符";
  }

  if (!name) {
    fields.name = "请填写一个称呼";
  } else if (characterCount(name) > 24) {
    fields.name = "称呼最多 24 个字符";
  }

  if (!birthday) {
    fields.birthday = "请选择生日";
  } else if (!isValidBirthday(birthday)) {
    fields.birthday = "请选择 1900 年以来的有效日期";
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return {
    ok: true,
    value: { account, password, name, birthday }
  };
}

function parseAvatarDataUrl(
  value: unknown
): { ok: true; value: { bytes: Uint8Array; mime: string } } | {
  ok: false;
  message: string;
} {
  if (typeof value !== "string") {
    return { ok: false, message: "头像数据格式不正确" };
  }

  const match = /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    value
  );
  if (!match) {
    return { ok: false, message: "仅支持 JPEG、PNG 或 WebP 图片" };
  }

  if (match[1].length > Math.ceil((MAX_AVATAR_BYTES * 4) / 3) + 8) {
    return { ok: false, message: "图片处理后仍然太大，请更换一张" };
  }

  const bytes = Buffer.from(match[1], "base64");
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES) {
    return { ok: false, message: "图片压缩后需小于 512KB" };
  }

  let mime = "";
  if (
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    mime = "image/jpeg";
  } else if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    mime = "image/png";
  } else if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    mime = "image/webp";
  }

  if (!mime) {
    return { ok: false, message: "无法识别这张图片，请更换后重试" };
  }

  return {
    ok: true,
    value: { bytes: new Uint8Array(bytes), mime }
  };
}

export function validateProfileInput(
  input: Record<string, unknown>
): Success<ProfileValues> | Failure {
  const name = asString(input.name).trim();
  const bio = asString(input.bio).trim();
  const birthday = asString(input.birthday).trim();
  const isAnonymous = input.isAnonymous === true;
  const avatarAction = asString(input.avatarAction) || "keep";
  const fields: ApiFieldErrors = {};

  if (!name) {
    fields.name = "请填写一个称呼";
  } else if (characterCount(name) > 24) {
    fields.name = "称呼最多 24 个字符";
  }

  if (characterCount(bio) > 160) {
    fields.bio = "简介最多 160 个字符";
  }

  if (!birthday) {
    fields.birthday = "请选择生日";
  } else if (!isValidBirthday(birthday, getToday())) {
    fields.birthday = "请选择 1900 年以来的有效日期";
  }

  let avatar: AvatarPayload = { action: "keep" };
  if (avatarAction === "remove") {
    avatar = { action: "remove" };
  } else if (avatarAction === "replace") {
    const parsed = parseAvatarDataUrl(input.avatarDataUrl);
    if (!parsed.ok) {
      fields.avatar = parsed.message;
    } else {
      avatar = {
        action: "replace",
        bytes: parsed.value.bytes,
        mime: parsed.value.mime
      };
    }
  } else if (avatarAction !== "keep") {
    fields.avatar = "头像操作无效";
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return {
    ok: true,
    value: { name, bio, birthday, isAnonymous, avatar }
  };
}

export function getMaxRequestBodyBytes() {
  return MAX_BODY_BYTES;
}
