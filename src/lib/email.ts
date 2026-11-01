const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "dispostable.com",
  "getnada.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "sharklasers.com",
  "temp-mail.org",
  "throwawaymail.com",
  "trashmail.com",
  "yopmail.com"
]);

export function normalizeEmail(value: string) {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function isValidEmail(value: string) {
  const normalized = normalizeEmail(value);
  if (!normalized || normalized.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) return false;
  const [local, domain] = normalized.split("@");
  if (!local || local.length > 64) return false;
  if (!domain || domain.length > 253 || domain.startsWith(".")) return false;
  return !domain.split(".").some((part) => !part);
}

export function emailDomain(value: string) {
  const normalized = normalizeEmail(value);
  const index = normalized.lastIndexOf("@");
  return index >= 0 ? normalized.slice(index + 1) : "";
}

export function isDisposableEmail(value: string) {
  return DISPOSABLE_DOMAINS.has(emailDomain(value));
}

export function maskEmail(value: string) {
  const normalized = normalizeEmail(value);
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return normalized;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
