import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionCookie,
  hashPassword
} from "@/lib/auth";
import {
  jsonError,
  jsonOk,
  readJsonBody,
  rejectCrossOrigin
} from "@/lib/api";
import { accountExists, createUser } from "@/lib/repository";
import { validateRegisterInput } from "@/lib/validation";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const validation = validateRegisterInput(body.data);
  if (!validation.ok) {
    return jsonError("请检查填写的内容", 422, validation.fields);
  }

  const values = validation.value;
  try {
    if (await accountExists(values.account)) {
      return jsonError("这个账号已经被使用了", 409, {
        account: "换一个账号试试"
      });
    }

    const id = crypto.randomUUID();
    // 先签名会话，确保生产环境缺少密钥时不会留下一个无法登录的账号。
    const token = await createSessionToken(id);
    const passwordHash = await hashPassword(values.password);
    const user = await createUser({
      id,
      account: values.account,
      passwordHash,
      name: values.name,
      birthday: values.birthday
    });

    const response = jsonOk({ user }, 201);
    response.cookies.set(getSessionCookie(token));
    return response;
  } catch (error) {
    console.error("register failed", error);
    if (
      error instanceof Error &&
      /UNIQUE|SQLITE_CONSTRAINT/i.test(error.message)
    ) {
      return jsonError("这个账号已经被使用了", 409, {
        account: "换一个账号试试"
      });
    }
    return jsonError("暂时无法完成注册，请稍后再试", 500);
  }
}
