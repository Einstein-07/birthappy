"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowIcon } from "@/components/Icons";
import { useToast } from "@/components/Toast";
import { isValidUid, normalizeUid, uidValidationMessage } from "@/lib/uid-rules";

export function UidEditor({
  initialUid,
  initialChangeCount
}: {
  initialUid: string;
  initialChangeCount: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [uid, setUid] = useState(initialUid);
  const [changeCount, setChangeCount] = useState(initialChangeCount);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialUid);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const remaining = Math.max(0, 1 - changeCount);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const nextUid = normalizeUid(value);
    if (!isValidUid(nextUid)) {
      setError(uidValidationMessage());
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/profile/uid", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: nextUid })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            user?: { uid: string; uidChangeCount: number };
            error?: string;
            fields?: Record<string, string>;
          }
        | null;

      if (!response.ok || !payload?.user) {
        setError(payload?.error || "UID 暂时没有修改成功");
        return;
      }

      setUid(payload.user.uid);
      setChangeCount(payload.user.uidChangeCount);
      setEditing(false);
      toast("UID 已更新，旧 UID 立即失效");
      router.refresh();
    } catch {
      setError("网络似乎走神了，请稍后再试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="uid-editor">
      <div className="uid-editor__current">
        <span className="account-bar__label">UID</span>
        <strong>{uid}</strong>
        <span className="uid-editor__remaining">
          {remaining > 0 ? "可修改 1 次" : "修改机会已用完"}
        </span>
      </div>

      {editing ? (
        <form className="uid-editor__form" onSubmit={handleSubmit}>
          <label className="field__label" htmlFor="uid-input">
            新 UID
          </label>
          <div className="uid-editor__row">
            <input
              id="uid-input"
              className={`text-input${error ? " has-error" : ""}`}
              value={value}
              onChange={(event) => setValue(event.target.value.toUpperCase())}
              placeholder="6–16 位字母、数字或下划线"
              maxLength={16}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button
              className="button button--primary uid-editor__save"
              type="submit"
              disabled={saving}
            >
              {saving ? "正在保存" : "确认修改"}
              {!saving ? (
                <ArrowIcon className="button__icon" aria-hidden="true" />
              ) : null}
            </button>
          </div>
          <p className="uid-editor__warning">
            UID 只能修改 1 次，修改后旧 UID 会立即失效，此操作不可撤销。
          </p>
          {error ? <p className="field__error">{error}</p> : null}
          <button
            type="button"
            className="text-button text-button--muted"
            onClick={() => {
              setEditing(false);
              setValue(uid);
              setError("");
            }}
            disabled={saving}
          >
            取消
          </button>
        </form>
      ) : remaining > 0 ? (
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setEditing(true);
            setValue(uid);
          }}
        >
          修改 UID（仅 1 次机会）
        </button>
      ) : (
        <p className="uid-editor__exhausted">
          UID 仅允许修改 1 次，你已经使用过这次机会。
        </p>
      )}
    </div>
  );
}
