import { resolve4 } from "node:dns/promises";
import { setDefaultResultOrder } from "node:dns";
import nodemailer, { type Transporter } from "nodemailer";
import { MAIL_SENDER_ADDRESS } from "@/lib/mail-constants";

// 无服务器运行时有时没有可用的 IPv6 出口；优先使用 IPv4，避免连接悬挂。
try {
  setDefaultResultOrder("ipv4first");
} catch {
  // 旧版本 Node 忽略即可。
}

export type VerificationPurpose = "register" | "bind" | "delete";

export class MailConfigurationError extends Error {
  constructor() {
    super("邮件服务尚未配置");
    this.name = "MailConfigurationError";
  }
}

const globalForMail = globalThis as unknown as {
  __birthappyMailer?: Transporter;
};

async function getMailer() {
  const user = process.env.MAIL_USER?.trim();
  const pass = process.env.MAIL_PASS?.trim();
  if (!user || !pass) throw new MailConfigurationError();

  if (!globalForMail.__birthappyMailer) {
    const configuredHost = process.env.MAIL_HOST?.trim() || "smtp.qq.com";
    let connectHost = configuredHost;
    let servername: string | undefined;
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(configuredHost)) {
      try {
        const addresses = await resolve4(configuredHost);
        if (addresses[0]) {
          connectHost = addresses[0];
          servername = configuredHost;
        }
      } catch {
        // 解析失败时退回域名，让节点自己处理。
      }
    }

    globalForMail.__birthappyMailer = nodemailer.createTransport({
      host: connectHost,
      port: Number(process.env.MAIL_PORT || 465),
      secure: process.env.MAIL_SECURE !== "false",
      auth: { user, pass },
      ...(servername ? { tls: { servername } } : {}),
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 15000
    });
  }

  return globalForMail.__birthappyMailer;
}

export function isMailConfigured() {
  return Boolean(process.env.MAIL_USER?.trim() && process.env.MAIL_PASS?.trim());
}

function purposeLabel(purpose: VerificationPurpose) {
  if (purpose === "bind") return "绑定邮箱";
  if (purpose === "delete") return "注销账号";
  return "注册";
}

export async function sendVerificationEmail(
  to: string,
  code: string,
  purpose: VerificationPurpose
) {
  const mailer = await getMailer();
  const user = process.env.MAIL_USER?.trim() || MAIL_SENDER_ADDRESS;
  const label = purposeLabel(purpose);
  const fromName = process.env.MAIL_FROM_NAME?.trim() || "BirtHappy";

  const text = [
    `你正在${label} BirtHappy。`,
    "",
    `验证码：${code}`,
    "验证码 10 分钟内有效，请勿转发给任何人。",
    "",
    `本邮件由 BirtHappy 通过 QQ 邮箱 ${MAIL_SENDER_ADDRESS} 发出。`,
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
        <p style="margin:0;color:#948b7e;font-size:12px;line-height:1.8;">本邮件由 BirtHappy 通过 QQ 邮箱 ${MAIL_SENDER_ADDRESS} 发出。如果这不是你本人的操作，请忽略本邮件。为防止诈骗，请只在本站页面输入验证码，不要向任何人提供验证码。</p>
      </div>
    </div>
  `;

  await mailer.sendMail({
    from: `"${fromName}" <${user}>`,
    to,
    subject: `BirtHappy ${label}验证码`,
    text,
    html
  });
}
