import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  EmailCodeError,
  cleanupOldEmailCodes,
  invalidateEmailCode,
  issueEmailCode,
  type EmailCodePurpose
} from "@/lib/auth-codes";
import { jsonError, readJsonBody, rejectCrossOrigin } from "@/lib/api";
import {
  isDisposableEmail,
  isValidEmail,
  normalizeEmail
} from "@/lib/email";
import {
  MailConfigurationError,
  isMailConfigured,
  sendVerificationEmail
} from "@/lib/mail";
import { getClientIpHash } from "@/lib/request";
import {
  DAILY_REGISTRATION_LIMIT,
  getDailyRegistrationUsed,
  isEmailTaken
} from "@/lib/repository";

function detailedError(
  message: string,
  status: number,
  code: string,
  fields?: Record<string, string>,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    { error: message, code, ...(fields ? { fields } : {}), ...(details ?? {}) },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const purposeValue =
    typeof body.data.purpose === "string" ? body.data.purpose : "";
  if (!["register", "bind", "delete"].includes(purposeValue)) {
    return jsonError("验证码用途不正确", 422);
  }
  const purpose = purposeValue as EmailCodePurpose;

  if (typeof body.data.website === "string" && body.data.website.trim()) {
    return jsonError("请求未通过安全检查", 400);
  }

  const user = await getCurrentUser();
  if (purpose !== "register" && !user) {
    return jsonError("请先登录", 401);
  }

  let email = normalizeEmail(
    typeof body.data.email === "string" ? body.data.email : ""
  );

  if (purpose === "delete") {
    if (!user?.email) {
      return jsonError("请先绑定邮箱，再进行注销验证", 409);
    }
    email = user.email;
  } else {
    if (!email) {
      return detailedError("请填写邮箱", 422, "EMAIL_REQUIRED", {
        email: "请填写邮箱"
      });
    }
    if (!isValidEmail(email)) {
      return detailedError("请输入有效的邮箱地址", 422, "INVALID_EMAIL", {
        email: "请输入有效的邮箱地址"
      });
    }
    if (isDisposableEmail(email)) {
      return detailedError(
        "暂不支持一次性邮箱，请使用常用邮箱",
        422,
        "DISPOSABLE_EMAIL",
        { email: "暂不支持一次性邮箱" }
      );
    }
    if (purpose === "bind" && user?.email) {
      return jsonError("这个账号已经绑定邮箱", 409);
    }
    if (await isEmailTaken(email, user?.id)) {
      return detailedError("这个邮箱已经被使用", 409, "EMAIL_TAKEN", {
        email: "这个邮箱已经被使用"
      });
    }
  }

  if (purpose === "register") {
    const used = await getDailyRegistrationUsed();
    if (used >= DAILY_REGISTRATION_LIMIT) {
      return detailedError(
        "今日注册名额已满，请明天再试",
        429,
        "DAILY_REGISTRATION_LIMIT_REACHED",
        undefined,
        { dailyLimit: DAILY_REGISTRATION_LIMIT }
      );
    }
  }

  if (!isMailConfigured()) {
    return jsonError("邮件服务尚未配置，请联系管理员", 503);
  }

  const ipHash = getClientIpHash(request);
  try {
    await cleanupOldEmailCodes().catch(() => undefined);
    const issued = await issueEmailCode({
      email,
      purpose,
      userId: purpose === "register" ? null : (user?.id ?? null),
      ipHash
    });

    try {
      await sendVerificationEmail(issued.email, issued.code, purpose);
    } catch (error) {
      await invalidateEmailCode(issued.id);
      if (error instanceof MailConfigurationError) {
        console.error("mail is not configured");
        return jsonError("邮件服务尚未配置，请联系管理员", 503);
      }
      console.error("send verification email failed", error);
      const mailErrorCode =
        error instanceof Error &&
        "code" in error &&
        typeof (error as Error & { code?: unknown }).code === "string"
          ? (error as Error & { code: string }).code
          : "UNKNOWN";
      const status = mailErrorCode === "RESEND_429" ? 429 : 502;
      return NextResponse.json(
        {
          error:
            status === 429
              ? "验证码发送额度暂时用完，请稍后再试"
              : "验证码邮件发送失败，请稍后重试",
          code: "MAIL_SEND_FAILED",
          mailErrorCode,
          mailDetail:
            error instanceof Error && "detail" in error
              ? (error as Error & { detail?: string }).detail
              : undefined
        },
        {
          status,
          headers: { "Cache-Control": "no-store" }
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message:
          purpose === "register"
            ? "验证码已发送，请查看收件箱和垃圾邮件"
            : "验证码已发送",
        cooldownSeconds: issued.cooldownSeconds,
        expiresInMinutes: 10
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof EmailCodeError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(error.fields ? { fields: error.fields } : {}),
          ...(error.details ?? {})
        },
        {
          status: error.status,
          headers: {
            "Cache-Control": "no-store",
            ...(typeof error.details?.retryAfterSeconds === "number"
              ? {
                  "Retry-After": String(error.details.retryAfterSeconds)
                }
              : {})
          }
        }
      );
    }
    console.error("issue email code failed", error);
    return jsonError("验证码暂时无法发送，请稍后再试", 500);
  }
}
