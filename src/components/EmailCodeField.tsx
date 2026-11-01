"use client";

import { useEffect, useState } from "react";
import { ArrowIcon, SparkIcon } from "@/components/Icons";
import { MAIL_SENDER_ADDRESS } from "@/lib/mail-constants";

export type EmailCodePurpose = "register" | "bind" | "delete";

export function EmailCodeField({
  email,
  purpose,
  code,
  onCodeChange,
  disabled = false,
  website = "",
  label = "邮箱验证码"
}: {
  email: string;
  purpose: EmailCodePurpose;
  code: string;
  onCodeChange: (value: string) => void;
  disabled?: boolean;
  website?: string;
  label?: string;
}) {
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    if (sending || cooldown > 0) return;
    setMessage("");
    setError("");

    if (purpose !== "delete" && !email.trim()) {
      setError("请先填写邮箱");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/auth/email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: purpose === "delete" ? undefined : email.trim(),
          purpose,
          website
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            cooldownSeconds?: number;
            retryAfterSeconds?: number;
            fields?: Record<string, string>;
          }
        | null;

      if (!response.ok) {
        setCooldown(Number(payload?.retryAfterSeconds ?? 0));
        setError(payload?.error || "验证码暂时没有发送成功");
        return;
      }

      setCooldown(Number(payload?.cooldownSeconds ?? 60));
      setMessage(payload?.message || "验证码已发送，请查看邮箱和垃圾邮件");
    } catch {
      setError("网络似乎走神了，请稍后重试");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="email-code-field">
      <div className="field__label-row">
        <label className="field__label" htmlFor={`email-code-${purpose}`}>
          {label}
        </label>
        <button
          type="button"
          className="code-send-button"
          onClick={sendCode}
          disabled={sending || disabled || cooldown > 0}
        >
          {sending
            ? "正在发送"
            : cooldown > 0
              ? `${cooldown} 秒后可重发`
              : "发送验证码"}
          {!sending && cooldown === 0 ? (
            <ArrowIcon aria-hidden="true" />
          ) : null}
        </button>
      </div>
      <input
        id={`email-code-${purpose}`}
        className="text-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) =>
          onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        placeholder="输入 6 位验证码"
        maxLength={6}
        disabled={disabled}
      />
      <p className="mail-security-note">
        <SparkIcon aria-hidden="true" />
        验证邮件由 QQ 邮箱 <strong>{MAIL_SENDER_ADDRESS}</strong>{" "}
        发出，可能被判定为垃圾邮件，请同时检查垃圾箱或广告邮件。请勿向任何人提供验证码。
      </p>
      {message ? (
        <p className="email-code-status is-success" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="email-code-status is-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
