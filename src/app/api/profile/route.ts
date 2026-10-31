import { getCurrentUser } from "@/lib/auth";
import {
  jsonError,
  jsonOk,
  readJsonBody,
  rejectCrossOrigin
} from "@/lib/api";
import { updateUserProfile } from "@/lib/repository";
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
  try {
    const updated = await updateUserProfile(
      user.id,
      {
        name: values.name,
        bio: values.bio,
        birthday: values.birthday,
        isAnonymous: values.isAnonymous
      },
      values.avatar
    );
    if (!updated) return jsonError("没有找到你的资料", 404);
    return jsonOk({ user: updated });
  } catch (error) {
    console.error("profile update failed", error);
    return jsonError("资料暂时没有保存成功，请稍后再试", 500);
  }
}
