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

  const account =
    typeof body.data.account === "string" ? body.data.account.trim() : "";
  const password =
    typeof body.data.password === "string" ? body.data.password : "";

  if (!account || !password) {
    return jsonError("请填写账号和密码", 422);
  }

  try {
    const user = await authenticate(account, password);
    if (!user) {
      return jsonError("账号或密码不正确", 401);
    }

    const token = await createSessionToken(user.id);
    const response = jsonOk({ user });
    response.cookies.set(getSessionCookie(token));
    return response;
  } catch (error) {
    console.error("login failed", error);
    return jsonError("暂时无法登录，请稍后再试", 500);
  }
}
