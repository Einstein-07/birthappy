"use client";

import { Logo } from "@/components/Logo";

export default function GlobalError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="status-page">
      <div className="status-page__card">
        <Logo />
        <p className="eyebrow">A SMALL PAUSE</p>
        <h1>刚刚有一小阵风吹过。</h1>
        <p className="status-page__lede">
          页面暂时没有加载出来。可以再试一次，或者稍后回来看看今天是谁的生日。
        </p>
        <button className="button button--primary" type="button" onClick={reset}>
          再试一次
        </button>
      </div>
    </div>
  );
}
