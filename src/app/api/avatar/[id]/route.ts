import { getAvatar } from "@/lib/repository";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id || id.length > 80) {
    return new Response("Not found", { status: 404 });
  }

  const avatar = await getAvatar(id);
  if (!avatar) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const body = new Blob([avatar.bytes as unknown as BlobPart], {
    type: avatar.mime
  });
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": avatar.mime,
      "Content-Length": String(avatar.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
