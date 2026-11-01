import { randomBytes } from "node:crypto";
import { isValidUid, normalizeUid } from "@/lib/uid-rules";

const UID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateUid() {
  const bytes = randomBytes(8);
  let suffix = "";
  for (let index = 0; index < 8; index += 1) {
    suffix += UID_ALPHABET[bytes[index] % UID_ALPHABET.length];
  }
  return `BH${suffix}`;
}

export function legacyUidCandidate(account: string) {
  const normalized = normalizeUid(account);
  return isValidUid(normalized) ? normalized : null;
}
