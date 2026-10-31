import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  jsonError,
  jsonOk,
  readJsonBody,
  rejectCrossOrigin
} from "@/lib/api";
import {
  ProfileChangeError,
  saveUserProfile
} from "@/lib/repository";
import { validateProfileInput } from "@/lib/validation";

export async function PATCH(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const validation = validateProfileInput(body.data);
  if (!validation.ok) {
    return jsonError("请检查填写的内容", 422, validation.fields);
  }

  const values = validation.value;
  const confirmBirthdayReset = body.data.confirmBirthdayReset === true;

  try {
    const result = await saveUserProfile(
      user.id,
      {
        name: values.name,
        bio: values.bio,
        birthday: values.birthday,
        isAnonymous: values.isAnonymous,
        avatar: values.avatar
      },
      confirmBirthdayReset
    );
    return jsonOk(result);
  } catch (error) {
    if (error instanceof ProfileChangeError) {
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
    console.error("profile update failed", error);
    return jsonError("资料暂时没有保存成功，请稍后再试", 500);
  }
}
