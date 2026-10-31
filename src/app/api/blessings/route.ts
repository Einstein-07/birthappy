import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk, readJsonBody, rejectCrossOrigin } from "@/lib/api";
import { getToday, isBirthdayToday } from "@/lib/birthday";
import { createWish, getUserById } from "@/lib/repository";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const sender = await getCurrentUser();
  if (!sender) return jsonError("请先登录，再送出蛋糕", 401);

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const recipientId =
    typeof body.data.recipientId === "string" ? body.data.recipientId : "";

  if (!recipientId) return jsonError("没有找到这位朋友", 400);
  if (recipientId === sender.id) {
    return jsonError("今天也要记得给自己留一块蛋糕", 400);
  }

  try {
    const recipient = await getUserById(recipientId);
    if (!recipient) return jsonError("没有找到这位朋友", 404);
    if (!isBirthdayToday(recipient.birthday, getToday())) {
      return jsonError("今天不是 TA 的生日，蛋糕先留在手里吧", 400);
    }

    const created = await createWish(sender.id, recipient.id);
    return jsonOk(
      {
        ok: true,
        alreadySent: !created
      },
      created ? 201 : 200
    );
  } catch (error) {
    console.error("create blessing failed", error);
    return jsonError("蛋糕暂时没有送出去，请稍后再试", 500);
  }
}
