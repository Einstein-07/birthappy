"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EmailCodeField } from "@/components/EmailCodeField";
import { ArrowUpRightIcon, SparkIcon } from "@/components/Icons";
import { useToast } from "@/components/Toast";
import { maskEmail } from "@/lib/email";

const CONTACTS = [
  { label: "绛河", qq: "3586107948" },
  { label: "绛河の大肥鱼", qq: "2597530663" }
];

export function OtherSection({ email }: { email: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [deletingOpen, setDeletingOpen] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!deletingOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        setDeletingOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), a[href], input:not([disabled])"
        )
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [deletingOpen, loading]);

  async function deleteAccount() {
    if (loading || code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(payload?.error || "账号暂时没有注销成功");
        return;
      }
      toast("账号和所有相关数据已经删除");
      router.replace("/");
      router.refresh();
    } catch {
      setError("网络似乎走神了，请稍后再试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="other-card" aria-labelledby="other-heading">
      <div className="panel-heading panel-heading--compact">
        <div>
          <p className="eyebrow">MORE</p>
          <h2 id="other-heading">其他</h2>
        </div>
      </div>

      <div className="other-list">
        <details className="other-item">
          <summary>
            <span>
              <strong>联系我们</strong>
              <small>开发者 QQ 与用户群</small>
            </span>
            <span className="other-item__chevron" aria-hidden="true">
              +
            </span>
          </summary>
          <div className="other-contact">
            {CONTACTS.map((contact) => (
              <p key={contact.qq}>
                <span>{contact.label}</span>
                <strong>{contact.qq}</strong>
              </p>
            ))}
            <p>
              <span>BirtHappy 用户群</span>
              <strong>1049433315</strong>
            </p>
            <small>
              添加好友或入群时请说明来意，不要向任何人提供登录密码或验证码。
            </small>
          </div>
        </details>

        <Link
          className="other-item other-item--link"
          href="/privacy"
          target="_blank"
          rel="noreferrer"
        >
          <span>
            <strong>隐私协议</strong>
            <small>了解我们保存哪些数据、为什么保存</small>
          </span>
          <ArrowUpRightIcon aria-hidden="true" />
        </Link>

        <button
          className="other-item other-item--danger"
          type="button"
          onClick={() => {
            setCode("");
            setError("");
            setDeletingOpen(true);
          }}
        >
          <span>
            <strong>注销账号</strong>
            <small>验证邮箱后删除账号、UID 和全部相关数据</small>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {deletingOpen
        ? createPortal(
            <div
              className="confirm-backdrop"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !loading) {
                  setDeletingOpen(false);
                }
              }}
            >
              <div
                ref={dialogRef}
                className="confirm-dialog delete-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="delete-account-title"
              >
                <span className="confirm-dialog__mark" aria-hidden="true">
                  !
                </span>
                <p className="eyebrow">DELETE ACCOUNT</p>
                <h2 id="delete-account-title">注销账号？</h2>
                <p className="delete-dialog__warning">
                  注销后会永久删除你的账号、UID、头像、称呼、简介、生日、收到的祝福、
                  送出的祝福、切蛋糕记录和修改额度。此操作不可撤销。
                </p>

                {email ? (
                  <>
                    <p className="delete-dialog__email">
                      验证码将发送至 <strong>{maskEmail(email)}</strong>
                    </p>
                    <EmailCodeField
                      email={email}
                      purpose="delete"
                      code={code}
                      onCodeChange={setCode}
                      disabled={loading}
                      label="邮箱验证码"
                    />
                  </>
                ) : (
                  <div className="account-bar__alert">
                    <span>注销账号前必须先绑定邮箱。</span>
                    <Link href="/bind-email">去绑定邮箱</Link>
                  </div>
                )}

                {error ? (
                  <div className="form-alert" role="alert">
                    <span aria-hidden="true">!</span>
                    {error}
                  </div>
                ) : null}

                <p className="delete-dialog__tip">
                  <SparkIcon aria-hidden="true" />
                  UID 回收后，其他用户可以在未来注册时重新获得相同 UID。
                </p>

                <div className="confirm-dialog__actions">
                  <button
                    ref={cancelRef}
                    type="button"
                    className="button button--secondary"
                    onClick={() => setDeletingOpen(false)}
                    disabled={loading}
                  >
                    保留账号
                  </button>
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => void deleteAccount()}
                    disabled={!email || code.length !== 6 || loading}
                  >
                    {loading ? (
                      <>
                        <span className="button-spinner" aria-hidden="true" />
                        正在注销
                      </>
                    ) : (
                      "确认注销"
                    )}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}
