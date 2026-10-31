"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowIcon, SparkIcon } from "@/components/Icons";

type AuthMode = "login" | "register";
type FieldErrors = Record<string, string>;

export function AuthForm({
  mode,
  nextPath,
  todayIso
}: {
  mode: AuthMode;
  nextPath: string;
  todayIso: string;
}) {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  function validate() {
    const nextErrors: FieldErrors = {};
    if (!account.trim()) {
      nextErrors.account = "请填写登录账号";
    } else if (!/^[A-Za-z0-9_]{3,24}$/.test(account.trim())) {
      nextErrors.account = "账号需为 3–24 位字母、数字或下划线";
    }

    if (!password) {
      nextErrors.password = "请填写密码";
    } else if (password.length < 8) {
      nextErrors.password = "密码至少需要 8 个字符";
    }

    if (isRegister) {
      if (!name.trim()) {
        nextErrors.name = "请填写一个称呼";
      } else if (Array.from(name.trim()).length > 24) {
        nextErrors.name = "称呼最多 24 个字符";
      }
      if (!birthday) {
        nextErrors.birthday = "请选择生日";
      } else if (birthday > todayIso) {
        nextErrors.birthday = "生日不能晚于今天";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGeneralError("");
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
                account: account.trim(),
                password,
                name: name.trim(),
                birthday
              }
            : { account: account.trim(), password }
        )
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; fields?: FieldErrors }
        | null;

      if (!response.ok) {
        if (payload?.fields) setErrors(payload.fields);
        setGeneralError(
          payload?.error ||
            (isRegister ? "暂时无法完成注册" : "账号或密码不正确")
        );
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
              <label className="field__label" htmlFor="auth-name">
                你的称呼
              </label>
              <span className="field__hint">会出现在首页</span>
            </div>
            <input
              id="auth-name"
              className={`text-input${errors.name ? " has-error" : ""}`}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="可填写昵称或真实姓名"
              maxLength={24}
              autoComplete="nickname"
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "auth-name-error" : undefined}
            />
            {errors.name ? (
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
        </>
      ) : null}

      <div className="field">
        <div className="field__label-row">
          <label className="field__label" htmlFor="auth-account">
            登录账号
          </label>
          {isRegister ? (
            <span className="field__hint">字母、数字或下划线</span>
          ) : null}
        </div>
        <input
          id="auth-account"
          className={`text-input${errors.account ? " has-error" : ""}`}
          type="text"
          value={account}
          onChange={(event) => setAccount(event.target.value)}
          placeholder={isRegister ? "例如：xiaoman_07" : "输入你的账号"}
          maxLength={24}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(errors.account)}
          aria-describedby={errors.account ? "auth-account-error" : undefined}
        />
        {errors.account ? (
          <p className="field__error" id="auth-account-error">
            {errors.account}
          </p>
        ) : null}
      </div>

      <div className="field">
        <div className="field__label-row">
          <label className="field__label" htmlFor="auth-password">
            密码
          </label>
          <span className="field__hint">
            {isRegister ? "至少 8 个字符" : "请妥善保存"}
          </span>
        </div>
        <input
          id="auth-password"
          className={`text-input${errors.password ? " has-error" : ""}`}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder={isRegister ? "为今天留一把小钥匙" : "输入密码"}
          maxLength={72}
          autoComplete={isRegister ? "new-password" : "current-password"}
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

      <button className="button button--primary auth-submit" type="submit" disabled={loading}>
        {loading ? (
          <>
            <span className="button-spinner" aria-hidden="true" />
            {isRegister ? "正在为你留一个位置" : "正在打开门"}
          </>
        ) : (
          <>
            {isRegister ? "留下我的生日" : "回到我的小小宇宙"}
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
              写下一个生日
            </Link>
          </>
        )}
      </p>

      <p className="auth-form__note">
        <SparkIcon aria-hidden="true" />
        {isRegister
          ? "生日年份只用于保存日期，不会公开展示，也不显示年龄。"
          : "这是一个轻而安静的地方，只记得今天。"}
      </p>
    </form>
  );
}
