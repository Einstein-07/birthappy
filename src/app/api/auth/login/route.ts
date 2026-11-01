import {
  authenticate,
  createSessionToken,
  getSessionCookie
} from "@/lib/auth";
import { jsonError, jsonOk, readJsonBody, rejectCrossOrigin } from "@/lib/api";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const identifier =
    typeof body.data.identifier === "string"
      ? body.data.identifier.trim()
      : typeof body.data.account === "string"
        ? body.data.account.trim()
        : "";
  const password =
    typeof body.data.password === "string" ? body.data.password : "";

  if (!identifier || !password) {
    return jsonError("请填写邮箱/UID 和密码", 422);
  }

  try {
    const result = await authenticate(identifier, password);
    if (!result) {
      return jsonError("邮箱、UID 或密码不正确", 401);
    }

    const token = await createSessionToken(result.user.id);
    const response = jsonOk({
      user: result.user,
      needsEmailBinding: result.needsEmailBinding
    });
    response.cookies.set(getSessionCookie(token));
    return response;
  } catch (error) {
    console.error("login failed", error);
    return jsonError("暂时无法登录，请稍后再试", 500);
  }
}
