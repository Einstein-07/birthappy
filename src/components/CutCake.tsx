"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CakeSliceIcon, HeartIcon, SparkIcon } from "@/components/Icons";
import { useToast } from "@/components/Toast";

type CutResult = { responded: number; shared: number };

export function CutCake({ initialPending }: { initialPending: number }) {
  const [pending, setPending] = useState(initialPending);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CutResult | null>(null);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    setPending(initialPending);
  }, [initialPending]);

  async function handleCut() {
    if (loading || pending === 0) return;
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/me/cut-cake", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            responded?: number;
            shared?: number;
            message?: string;
          }
        | null;

      if (response.status === 401) {
        router.push("/login?next=/me");
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.error || "蛋糕暂时没有切好，请稍后再试");
      }

      const responded = payload?.responded ?? 0;
      const shared = payload?.shared ?? 0;
      setPending(0);
      if (responded > 0) {
        setResult({ responded, shared });
        toast(
          shared > 0
            ? `已回应 ${responded} 份祝福，回礼也送到了朋友手里`
            : `已回应 ${responded} 份祝福`
        );
      } else {
        toast(payload?.message || "暂时没有需要回应的祝福");
      }
      router.refresh();
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "蛋糕暂时没有切好，请稍后再试",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="cut-card" aria-labelledby="cut-heading">
      <div className="cut-card__art" aria-hidden="true">
        <CakeSliceIcon />
        <span className="cut-card__spark cut-card__spark--one">
          <SparkIcon />
        </span>
        <span className="cut-card__spark cut-card__spark--two">
          <SparkIcon />
        </span>
      </div>

      <div className="cut-card__content">
        <p className="eyebrow">SHARE THE CAKE</p>
        <h2 id="cut-heading">切蛋糕</h2>
        <p className="cut-card__lede">
          回应所有还没回应的生日祝福，并把一片蛋糕回赠给他们。朋友收到的那一片，也会被好好记进他们的祝福里。
        </p>

        <div className="cut-card__pending" aria-live="polite">
          {pending > 0 ? (
            <>
              <strong>{pending}</strong>
              <span>份祝福正在等你回应</span>
            </>
          ) : result ? (
            <>
              <HeartIcon />
              <span>这次的心意已经送达</span>
            </>
          ) : (
            <span>现在没有需要回应的祝福</span>
          )}
        </div>

        <button
          type="button"
          className="button button--cake"
          onClick={handleCut}
          disabled={loading || pending === 0}
        >
          {loading ? (
            <>
              <span className="button-spinner" aria-hidden="true" />
              正在切蛋糕
            </>
          ) : (
            <>
              <CakeSliceIcon className="button__icon" />
              {pending > 0 ? "切蛋糕" : "暂时没有待回应的祝福"}
            </>
          )}
        </button>

        {result ? (
          <div className="cut-result" aria-live="polite">
            <SparkIcon aria-hidden="true" />
            <p>
              已回应 <strong>{result.responded}</strong> 份祝福，
              {result.shared > 0 ? (
                <>
                  送出 <strong>{result.shared}</strong> 块回礼。
                </>
              ) : (
                <>回礼也在路上了。</>
              )}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
