import { getCurrentUser } from "@/lib/auth";
import { jsonError, jsonOk, rejectCrossOrigin } from "@/lib/api";
import { cutCake } from "@/lib/repository";

export async function POST(request: Request) {
  const originError = rejectCrossOrigin(request);
  if (originError) return originError;

  const user = await getCurrentUser();
  if (!user) return jsonError("请先登录", 401);

  try {
    const result = await cutCake(user.id);
    if (result.responded === 0) {
      return jsonOk({
        ok: true,
        responded: 0,
        shared: 0,
        message: "暂时没有需要回应的祝福"
      });
    }

    return jsonOk({
      ok: true,
      responded: result.responded,
      shared: result.shared,
      message: "蛋糕已经切好，回礼也送到了朋友们手里"
    });
  } catch (error) {
    console.error("cut cake failed", error);
    return jsonError("蛋糕暂时没有切好，请稍后再试", 500);
  }
}
