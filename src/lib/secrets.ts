const DEVELOPMENT_SECRET =
  "birthappy-local-development-secret-do-not-use-in-production";

export function getAuthSecret() {
  const configured = process.env.AUTH_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!configured || configured.length < 32) {
      throw new Error(
        "缺少可用的 AUTH_SECRET。请在部署环境设置至少 32 个字符的随机字符串。"
      );
    }
    return configured;
  }

  return configured || DEVELOPMENT_SECRET;
}

export function getAuthSecretBytes() {
  return new TextEncoder().encode(getAuthSecret());
}
