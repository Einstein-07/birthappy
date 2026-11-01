export const UID_MIN_LENGTH = 6;
export const UID_MAX_LENGTH = 16;

const RESERVED_UIDS = new Set([
  "ADMIN",
  "ADMINISTRATOR",
  "BIRTHAPPY",
  "ROOT",
  "SYSTEM",
  "SUPPORT",
  "OFFICIAL"
]);

export function normalizeUid(value: string) {
  return value.trim().toUpperCase();
}

export function isValidUid(value: string) {
  const normalized = normalizeUid(value);
  if (normalized.length < UID_MIN_LENGTH || normalized.length > UID_MAX_LENGTH) {
    return false;
  }
  if (!/^[A-Z0-9_]+$/.test(normalized)) return false;
  if (RESERVED_UIDS.has(normalized)) return false;
  return true;
}

export function uidValidationMessage() {
  return `UID 需为 ${UID_MIN_LENGTH}–${UID_MAX_LENGTH} 位字母、数字或下划线，且不能使用系统保留名称`;
}
