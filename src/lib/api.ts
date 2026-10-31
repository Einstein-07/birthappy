import { NextResponse } from "next/server";
import type { ApiFieldErrors } from "@/lib/types";
import { getMaxRequestBodyBytes } from "@/lib/validation";

export function jsonError(
  message: string,
  status = 400,
  fields?: ApiFieldErrors
) {
  return NextResponse.json(
    { error: message, ...(fields ? { fields } : {}) },
    {
      status,
      headers: { "Cache-Control": "no-store" }
    }
  );
}

export function jsonOk<T extends Record<string, unknown>>(
  payload: T,
  status = 200
) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function rejectCrossOrigin(request: Request) {
  if (isSameOrigin(request)) return null;
  return jsonError("请求来源校验失败，请刷新页面后重试", 403);
}

export async function readJsonBody(
  request: Request
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; response: NextResponse }
> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > getMaxRequestBodyBytes()) {
    return {
      ok: false,
      response: jsonError("提交内容过大，请换一张更小的图片", 413)
    };
  }

  try {
    const data: unknown = await request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {
        ok: false,
        response: jsonError("请求内容格式不正确")
      };
    }
    return { ok: true, data: data as Record<string, unknown> };
  } catch {
    return {
      ok: false,
      response: jsonError("请求内容格式不正确")
    };
  }
}

export function safeNextPath(value: unknown, fallback = "/me") {
  if (typeof value !== "string") return fallback;
  if (value === "/" || value === "/me") return value;
  return fallback;
}
