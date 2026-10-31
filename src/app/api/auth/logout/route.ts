import { getExpiredSessionCookie } from "@/lib/auth";
import { jsonOk, rejectCrossOrigin } from "@/lib/api";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const response = jsonOk({ ok: true });
  response.cookies.set(getExpiredSessionCookie());
  return response;
}
