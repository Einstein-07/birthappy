"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EmailCodeField } from "@/components/EmailCodeField";
import { ArrowIcon } from "@/components/Icons";
import { useToast } from "@/components/Toast";

export function BindEmailForm({
  uid,
  mailSender
}: {
  uid: string;
  mailSender?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError("");
    setErrors({});

    const nextErrors: Record<string, string> = {};
    if (!email.trim()) nextErrors.email = "请填写邮箱";
    if (!/^\d{6}$/.test(code)) nextErrors.code = "请输入 6 位验证码";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/bind-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code })
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; fields?: Record<string, string> }
        | null;

      if (!response.ok) {
        if (payload?.fields) setErrors(payload.fields);
        setGeneralError(payload?.error || "邮箱暂时没有绑定成功");
        return;
      }

      toast("邮箱已经绑定，之后可以用邮箱或 UID 登录");
      router.replace("/me");
      router.refresh();
    } catch {
      setGeneralError("网络似乎走神了，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      {generalError ? (
        <div className="form-alert" role="alert">
          <span aria-hidden="true">!</span>
          {generalError}
        </div>
      ) : null}

      <div className="bind-uid">
        <span>你的 UID</span>
        <strong>{uid}</strong>
        <small>UID 可用于登录，之后还可以修改一次。</small>
      </div>

      <div className="field">
        <div className="field__label-row">
          <label className="field__label" htmlFor="bind-email">
            绑定邮箱
          </label>
          <span className="field__hint">用于登录和注销验证</span>
        </div>
        <input
          id="bind-email"
          className={`text-input${errors.email ? " has-error" : ""}`}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
        />
        {errors.email ? <p className="field__error">{errors.email}</p> : null}
      </div>

      <EmailCodeField
        email={email}
        purpose="bind"
        code={code}
        onCodeChange={setCode}
        disabled={loading}
        mailSender={mailSender}
        label="邮箱验证码"
      />
      {errors.code ? (
        <p className="field__error" style={{ marginTop: "-10px" }}>
          {errors.code}
        </p>
      ) : null}

      <button
        className="button button--primary auth-submit"
        type="submit"
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="button-spinner" aria-hidden="true" />
            正在绑定
          </>
        ) : (
          <>
            绑定邮箱，继续使用
            <ArrowIcon className="button__icon" />
          </>
        )}
      </button>

      <p className="auth-form__legacy-note">
        这是旧账号的一次性迁移步骤。绑定后，你将使用邮箱或 UID 登录；
        <Link href="/me"> 先去「我」页 </Link>
        也可以，但注销账号前必须绑定邮箱。
      </p>
    </form>
  );
}
