import { NextResponse } from "next/server";
import {
  getCurrentUser,
  getExpiredSessionCookie
} from "@/lib/auth";
import {
  EmailCodeError,
  verifyEmailCode
} from "@/lib/auth-codes";
import {
  jsonError,
  jsonOk,
  readJsonBody,
  rejectCrossOrigin
} from "@/lib/api";
import {
  ProfileChangeError,
  deleteUserAccount
} from "@/lib/repository";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);
  if (!user.email) {
    return jsonError("请先绑定邮箱，再进行注销验证", 409);
  }

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const code =
    typeof body.data.code === "string" ? body.data.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return jsonError("请输入 6 位邮箱验证码", 422, {
      code: "请输入 6 位邮箱验证码"
    });
  }

  try {
    const verification = await verifyEmailCode({
      email: user.email,
      purpose: "delete",
      userId: user.id,
      code
    });
    await deleteUserAccount(user.id, verification.id);
    const response = jsonOk({ ok: true });
    response.cookies.set(getExpiredSessionCookie());
    return response;
  } catch (error) {
    if (error instanceof EmailCodeError || error instanceof ProfileChangeError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(error.fields ? { fields: error.fields } : {}),
          ...(error.details ?? {})
        },
        {
          status: error.status,
          headers: { "Cache-Control": "no-store" }
        }
      );
    }
    console.error("delete account failed", error);
    return jsonError("暂时无法注销账号，请稍后再试", 500);
  }
}
