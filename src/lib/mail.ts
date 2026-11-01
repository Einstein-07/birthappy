import { MAIL_SENDER_FALLBACK } from "@/lib/mail-constants";

export type VerificationPurpose = "register" | "bind" | "delete";

export class MailConfigurationError extends Error {
  constructor() {
    super("邮件服务尚未配置");
    this.name = "MailConfigurationError";
  }
}

function configuredSender() {
  return process.env.RESEND_FROM?.trim() || MAIL_SENDER_FALLBACK;
}

function purposeLabel(purpose: VerificationPurpose) {
  if (purpose === "bind") return "绑定邮箱";
  if (purpose === "delete") return "注销账号";
  return "注册";
}

export function isMailConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getMailSenderAddress() {
  const sender = configuredSender();
  const match = /<([^>]+)>/.exec(sender);
  return (match?.[1] ?? sender).trim();
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  purpose: VerificationPurpose
) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new MailConfigurationError();

  const label = purposeLabel(purpose);
  const sender = configuredSender();
  const senderAddress = getMailSenderAddress();

  const text = [
    `你正在${label} BirtHappy。`,
    "",
    `验证码：${code}`,
    "验证码 10 分钟内有效，请勿转发给任何人。",
    "",
    `本邮件由 BirtHappy 发出（发件地址：${senderAddress}）。`,
    "如果这不是你本人的操作，请忽略本邮件。",
    "为防止诈骗，请只在本站页面输入验证码，不要向任何人提供验证码。"
  ].join("\n");

  const html = `
    <div style="background:#f8f4ed;padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;color:#1f1d1a;">
      <div style="max-width:520px;margin:0 auto;background:#fffaf3;border:1px solid rgba(31,29,26,.1);border-radius:20px;padding:28px;">
        <p style="margin:0 0 18px;font-size:12px;letter-spacing:.12em;color:#948b7e;">BIRTHAPPY · ${label}</p>
        <h1 style="margin:0 0 16px;font-family:Georgia,'Songti SC',serif;font-size:26px;font-weight:500;">你的验证码</h1>
        <p style="margin:0 0 18px;color:#726b61;font-size:14px;line-height:1.8;">你正在${label} BirtHappy，请在页面中输入下面的验证码。</p>
        <div style="margin:24px 0;padding:18px;border-radius:14px;background:#f3e7db;text-align:center;font-size:34px;letter-spacing:.28em;font-weight:600;color:#9a4e34;">${code}</div>
        <p style="margin:0 0 10px;color:#726b61;font-size:13px;line-height:1.8;">验证码 10 分钟内有效，请勿转发给任何人。</p>
        <p style="margin:0;color:#948b7e;font-size:12px;line-height:1.8;">本邮件由 BirtHappy 发出（发件地址：${senderAddress}）。如果这不是你本人的操作，请忽略本邮件。为防止诈骗，请只在本站页面输入验证码，不要向任何人提供验证码。</p>
      </div>
    </div>
  `;

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: sender,
        to: [to],
        subject: `BirtHappy ${label}验证码`,
        text,
        html,
        ...(process.env.RESEND_REPLY_TO?.trim()
          ? { reply_to: process.env.RESEND_REPLY_TO.trim() }
          : {})
      }),
      signal: AbortSignal.timeout(12000)
    });
  } catch (error) {
    const sendError = new Error("Resend 请求失败") as Error & {
      code: string;
    };
    sendError.code =
      error instanceof Error && error.name === "TimeoutError"
        ? "RESEND_TIMEOUT"
        : "RESEND_NETWORK_ERROR";
    throw sendError;
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Resend send failed", response.status, detail.slice(0, 500));
    const sendError = new Error("Resend 拒绝了发信请求") as Error & {
      code: string;
    };
    sendError.code = `RESEND_${response.status}`;
    throw sendError;
  }

  return (await response.json().catch(() => ({}))) as { id?: string };
}
