import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  jsonError,
  jsonOk,
  readJsonBody,
  rejectCrossOrigin
} from "@/lib/api";
import { ProfileChangeError, updateUid } from "@/lib/repository";

export async function PATCH(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const uid = typeof body.data.uid === "string" ? body.data.uid.trim() : "";
  try {
    const result = await updateUid(user.id, uid);
    return jsonOk({
      user: result.user,
      changed: result.changed,
      remainingUidChanges: Math.max(0, 1 - result.user.uidChangeCount)
    });
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
    console.error("uid update failed", error);
    return jsonError("UID 暂时没有修改成功，请稍后再试", 500);
  }
}
