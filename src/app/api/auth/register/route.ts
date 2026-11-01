import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionCookie,
  hashPassword
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
import { normalizeEmail } from "@/lib/email";
import { verifyFormToken } from "@/lib/form-token";
import { getClientIpHash } from "@/lib/request";
import {
  RegistrationError,
  isEmailTaken,
  registerUser
} from "@/lib/repository";
import { validateRegisterInput } from "@/lib/validation";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  if (typeof body.data.website === "string" && body.data.website.trim()) {
    return jsonError("请求未通过安全检查", 400);
  }
  if (body.data.agreed !== true) {
    return jsonError("请先阅读并同意隐私协议", 422, {
      agreement: "请阅读并同意隐私协议"
    });
  }

  const formToken =
    typeof body.data.formToken === "string" ? body.data.formToken : "";
  const tokenCheck = verifyFormToken(formToken, "register");
  if (!tokenCheck.ok) {
    return jsonError(tokenCheck.reason, 400);
  }

  const validation = validateRegisterInput(body.data);
  if (!validation.ok) {
    return jsonError("请检查填写的内容", 422, validation.fields);
  }
  const values = validation.value;
  const email = normalizeEmail(values.email);

  try {
    if (await isEmailTaken(email)) {
      return jsonError("这个邮箱已经注册过了", 409, {
        email: "这个邮箱已经注册过了"
      });
    }

    let verification;
    try {
      verification = await verifyEmailCode({
        email,
        purpose: "register",
        userId: null,
        code: values.code
      });
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
            headers: { "Cache-Control": "no-store" }
          }
        );
      }
      throw error;
    }

    const id = crypto.randomUUID();
    const token = await createSessionToken(id);
    const passwordHash = await hashPassword(values.password);
    const user = await registerUser({
      id,
      email,
      passwordHash,
      name: values.name,
      birthday: values.birthday,
      ipHash: getClientIpHash(request),
      codeId: verification.id
    });

    const response = jsonOk({ user, needsEmailBinding: false }, 201);
    response.cookies.set(getSessionCookie(token));
    return response;
  } catch (error) {
    if (error instanceof RegistrationError) {
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
    console.error("register failed", error);
    if (
      error instanceof Error &&
      /UNIQUE|SQLITE_CONSTRAINT/i.test(error.message)
    ) {
      return jsonError("邮箱或 UID 已被占用，请重试", 409);
    }
    return jsonError("暂时无法完成注册，请稍后再试", 500);
  }
}
