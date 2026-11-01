import { createHmac } from "node:crypto";
import { getAuthSecret } from "@/lib/secrets";

export function getClientIp(request: Request) {
  const direct =
    request.headers.get("x-nf-client-connection-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return direct || "unknown";
}

export function getClientIpHash(request: Request) {
  return createHmac("sha256", getAuthSecret())
    .update(`birthappy-ip:${getClientIp(request)}`)
    .digest("hex");
}
