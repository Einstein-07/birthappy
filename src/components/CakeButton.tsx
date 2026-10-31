"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/Toast";
import { CakeSliceIcon, CheckIcon } from "@/components/Icons";

type CakeButtonProps = {
  recipientId: string;
  recipientName: string;
  initialSent: boolean;
  authenticated: boolean;
};

const SPARKS = [0, 1, 2, 3, 4, 5];

export function CakeButton({
  recipientId,
  recipientName,
  initialSent,
  authenticated
}: CakeButtonProps) {
  const [sent, setSent] = useState(initialSent);
  const [loading, setLoading] = useState(false);
  const [burst, setBurst] = useState(false);
  const burstTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (burstTimer.current) clearTimeout(burstTimer.current);
    };
  }, []);

  if (!authenticated) {
    return (
      <Link
        className="cake-button cake-button--guest"
        href="/login?next=/"
        aria-label={`登录后给${recipientName}送一块蛋糕`}
      >
        <CakeSliceIcon className="cake-button__icon" />
        <span>送一块蛋糕</span>
      </Link>
    );
  }

  async function sendCake() {
    if (sent || loading) return;
    setLoading(true);

    try {
      const response = await fetch("/api/blessings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId })
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; alreadySent?: boolean }
        | null;

      if (response.status === 401) {
        router.push("/login?next=/");
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.error || "蛋糕暂时没有送出去，请稍后再试");
      }

      setSent(true);
      setBurst(true);
      toast(
        payload?.alreadySent
          ? `这份心意已经在 ${recipientName} 那里了`
          : `一块蛋糕，已经送到 ${recipientName} 手里`
      );
      if (burstTimer.current) clearTimeout(burstTimer.current);
      burstTimer.current = setTimeout(() => setBurst(false), 900);
      router.refresh();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "蛋糕暂时没有送出去，请稍后再试",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={`cake-button${sent ? " is-sent" : ""}${burst ? " is-bursting" : ""}`}
      onClick={sendCake}
      disabled={sent || loading}
      aria-label={
        sent
          ? `已经给${recipientName}送过蛋糕`
          : `给${recipientName}送一块蛋糕`
      }
    >
      <span className="cake-button__icon-wrap" aria-hidden="true">
        {sent ? (
          <CheckIcon className="cake-button__icon" />
        ) : (
          <CakeSliceIcon className="cake-button__icon" />
        )}
      </span>
      <span>{loading ? "正在送出" : sent ? "已送达" : "送一块蛋糕"}</span>
      {burst ? (
        <span className="cake-sparks" aria-hidden="true">
          {SPARKS.map((spark) => (
            <i key={spark} className={`cake-spark cake-spark--${spark}`} />
          ))}
        </span>
      ) : null}
    </button>
  );
}
