"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { EmailCodeField } from "@/components/EmailCodeField";
import { ArrowIcon, SparkIcon } from "@/components/Icons";
import { sensitiveWarning } from "@/lib/sensitive-words";

type AuthMode = "login" | "register";
type FieldErrors = Record<string, string>;

export function AuthForm({
  mode,
  nextPath,
  todayIso,
  formToken = "",
  mailSender
}: {
  mode: AuthMode;
  nextPath: string;
  todayIso: string;
  formToken?: string;
  mailSender?: string;
}) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [website, setWebsite] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  const nameWarning = isRegister && name.trim()
    ? sensitiveWarning(name)
    : null;
  const submitBlocked = Boolean(nameWarning);

  function validate() {
    const nextErrors: FieldErrors = {};

    if (isRegister) {
      if (!email.trim()) {
        nextErrors.email = "请填写邮箱";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
        nextErrors.email = "请输入有效的邮箱地址";
      }
      if (!/^\d{6}$/.test(code)) {
        nextErrors.code = "请输入 6 位邮箱验证码";
      }
      if (!name.trim()) {
        nextErrors.name = "请填写一个称呼";
      } else if (Array.from(name.trim()).length > 24) {
        nextErrors.name = "称呼最多 24 个字符";
      } else if (nameWarning) {
        nextErrors.name = nameWarning.message;
      }
      if (!birthday) {
        nextErrors.birthday = "请选择生日";
      } else if (birthday > todayIso) {
        nextErrors.birthday = "生日不能晚于今天";
      }
      if (!agreed) {
        nextErrors.agreement = "请先阅读并同意隐私协议";
      }
    } else if (!identifier.trim()) {
      nextErrors.identifier = "请填写邮箱或 UID";
    }

    if (!password) {
      nextErrors.password = "请填写密码";
    } else if (password.length < 8) {
      nextErrors.password = "密码至少需要 8 个字符";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError("");
    if (submitBlocked) return;
    if (!validate()) return;

    setLoading(true);
    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? {
                email: email.trim(),
                code,
                password,
                name: name.trim(),
                birthday,
                agreed,
                website,
                formToken
              }
            : { identifier: identifier.trim(), password }
        )
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            fields?: FieldErrors;
            needsEmailBinding?: boolean;
          }
        | null;

      if (!response.ok) {
        if (payload?.fields) setErrors(payload.fields);
        setGeneralError(
          payload?.error ||
            (isRegister ? "暂时无法完成注册" : "邮箱、UID 或密码不正确")
        );
        return;
      }

      if (!isRegister && payload?.needsEmailBinding) {
        router.replace("/bind-email");
        router.refresh();
        return;
      }

      router.replace(nextPath);
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

      {isRegister ? (
        <>
          <div className="field">
            <div className="field__label-row">
              <label className="field__label" htmlFor="auth-email">
                邮箱
              </label>
              <span className="field__hint">用于登录和找回账号</span>
            </div>
            <input
              id="auth-email"
              className={`text-input${errors.email ? " has-error" : ""}`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "auth-email-error" : undefined}
            />
            {errors.email ? (
              <p className="field__error" id="auth-email-error">
                {errors.email}
              </p>
            ) : null}
          </div>

          <EmailCodeField
            email={email}
            purpose="register"
            code={code}
            onCodeChange={setCode}
            disabled={loading}
            website={website}
            mailSender={mailSender}
          />
          {errors.code ? (
            <p className="field__error" style={{ marginTop: "-10px" }}>
              {errors.code}
            </p>
          ) : null}

          <div className="field">
            <div className="field__label-row">
              <label className="field__label" htmlFor="auth-name">
                你的称呼
              </label>
              <span className="field__hint">会出现在首页</span>
            </div>
            <input
              id="auth-name"
              className={`text-input${errors.name || nameWarning ? " has-error" : ""}`}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="可填写昵称或真实姓名"
              maxLength={24}
              autoComplete="nickname"
              aria-invalid={Boolean(errors.name || nameWarning)}
              aria-describedby={
                errors.name || nameWarning ? "auth-name-error" : undefined
              }
            />
            {nameWarning ? (
              <p className="sensitive-warning" id="auth-name-error">
                {nameWarning.message}
              </p>
            ) : errors.name ? (
              <p className="field__error" id="auth-name-error">
                {errors.name}
              </p>
            ) : null}
          </div>

          <div className="field">
            <div className="field__label-row">
              <label className="field__label" htmlFor="auth-birthday">
                生日
              </label>
              <span className="field__hint">只公开月和日</span>
            </div>
            <input
              id="auth-birthday"
              className={`text-input${errors.birthday ? " has-error" : ""}`}
              type="date"
              value={birthday}
              min="1900-01-01"
              max={todayIso}
              onChange={(event) => setBirthday(event.target.value)}
              autoComplete="bday"
              aria-invalid={Boolean(errors.birthday)}
              aria-describedby={
                errors.birthday ? "auth-birthday-error" : undefined
              }
            />
            {errors.birthday ? (
              <p className="field__error" id="auth-birthday-error">
                {errors.birthday}
              </p>
            ) : null}
          </div>

          <div className="field">
            <div className="field__label-row">
              <label className="field__label" htmlFor="auth-password">
                密码
              </label>
              <span className="field__hint">至少 8 个字符</span>
            </div>
            <input
              id="auth-password"
              className={`text-input${errors.password ? " has-error" : ""}`}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="为今天留一把小钥匙"
              maxLength={72}
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "auth-password-error" : undefined
              }
            />
            {errors.password ? (
              <p className="field__error" id="auth-password-error">
                {errors.password}
              </p>
            ) : null}
          </div>

          <div className="honeypot" aria-hidden="true">
            <label htmlFor="auth-company-fax">公司传真（请勿填写）</label>
            <input
              id="auth-company-fax"
              name="bh_hp"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </div>

          <label className={`agreement-row${errors.agreement ? " has-error" : ""}`}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <span>
              我已阅读并同意
              <Link href="/privacy" target="_blank" rel="noreferrer">
                《隐私协议》
              </Link>
            </span>
          </label>
          {errors.agreement ? (
            <p className="field__error" style={{ marginTop: "-8px" }}>
              {errors.agreement}
            </p>
          ) : null}

          <p className="auth-form__limit-note">
            每日最多新增 100 位注册用户。若名额已满，请次日再试。
          </p>
        </>
      ) : (
        <>
          <div className="field">
            <div className="field__label-row">
              <label className="field__label" htmlFor="auth-identifier">
                邮箱或 UID
              </label>
            </div>
            <input
              id="auth-identifier"
              className={`text-input${errors.identifier ? " has-error" : ""}`}
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="name@example.com 或 BHXXXXXXXX"
              maxLength={254}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(errors.identifier)}
              aria-describedby={
                errors.identifier ? "auth-identifier-error" : undefined
              }
            />
            {errors.identifier ? (
              <p className="field__error" id="auth-identifier-error">
                {errors.identifier}
              </p>
            ) : null}
          </div>

          <div className="field">
            <div className="field__label-row">
              <label className="field__label" htmlFor="auth-password">
                密码
              </label>
              <span className="field__hint">请妥善保存</span>
            </div>
            <input
              id="auth-password"
              className={`text-input${errors.password ? " has-error" : ""}`}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="输入密码"
              maxLength={72}
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              aria-describedby={
                errors.password ? "auth-password-error" : undefined
              }
            />
            {errors.password ? (
              <p className="field__error" id="auth-password-error">
                {errors.password}
              </p>
            ) : null}
          </div>

          <p className="auth-form__legacy-note">
            2026 年 11 月之前注册的旧账号，可先用原账号名登录，随后会引导绑定邮箱。
          </p>
        </>
      )}

      <button
        className="button button--primary auth-submit"
        type="submit"
        disabled={loading || submitBlocked}
      >
        {loading ? (
          <>
            <span className="button-spinner" aria-hidden="true" />
            {isRegister ? "正在为你留一个位置" : "正在打开门"}
          </>
        ) : (
          <>
            {isRegister ? "用邮箱留下我的生日" : "回到我的小小宇宙"}
            <ArrowIcon className="button__icon" />
          </>
        )}
      </button>

      <p className="auth-form__switch">
        {isRegister ? (
          <>
            已经有账号了？
            <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>
              回到登录
            </Link>
          </>
        ) : (
          <>
            还没有账号？
            <Link href={`/register?next=${encodeURIComponent(nextPath)}`}>
              用邮箱注册
            </Link>
          </>
        )}
      </p>

      <p className="auth-form__note">
        <SparkIcon aria-hidden="true" />
        {isRegister
          ? "生日年份只用于保存日期，不会公开展示，也不显示年龄。"
          : "这里只记得今天，也只展示今天过生日的人。"}
      </p>
    </form>
  );
}
