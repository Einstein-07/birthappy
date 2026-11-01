import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
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
  isDisposableEmail,
  isValidEmail,
  normalizeEmail
} from "@/lib/email";
import {
  ProfileChangeError,
  bindUserEmail,
  isEmailTaken
} from "@/lib/repository";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);
  if (user.email) return jsonError("这个账号已经绑定邮箱", 409);

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const email = normalizeEmail(
    typeof body.data.email === "string" ? body.data.email : ""
  );
  const code =
    typeof body.data.code === "string" ? body.data.code.trim() : "";

  if (!isValidEmail(email)) {
    return jsonError("请输入有效的邮箱地址", 422, {
      email: "请输入有效的邮箱地址"
    });
  }
  if (isDisposableEmail(email)) {
    return jsonError("暂不支持一次性邮箱，请使用常用邮箱", 422, {
      email: "暂不支持一次性邮箱"
    });
  }
  if (!/^\d{6}$/.test(code)) {
    return jsonError("请输入 6 位邮箱验证码", 422, {
      code: "请输入 6 位邮箱验证码"
    });
  }
  if (await isEmailTaken(email, user.id)) {
    return jsonError("这个邮箱已经被使用", 409, {
      email: "这个邮箱已经被使用"
    });
  }

  try {
    const verification = await verifyEmailCode({
      email,
      purpose: "bind",
      userId: user.id,
      code
    });
    const updated = await bindUserEmail(user.id, email, verification.id);
    return jsonOk({ user: updated });
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
    console.error("bind email failed", error);
    return jsonError("暂时无法绑定邮箱，请稍后再试", 500);
  }
}
