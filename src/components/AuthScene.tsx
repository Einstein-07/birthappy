import { CakeArt } from "@/components/CakeArt";
import { getToday } from "@/lib/birthday";

export function AuthScene({ mode }: { mode: "login" | "register" }) {
  const today = getToday();

  return (
    <section className="auth-scene" aria-label="BirtHappy 的一句话">
      <div className="auth-scene__head">
        <p className="eyebrow">
          <span className="eyebrow__dot" aria-hidden="true" />
          {mode === "login" ? "WELCOME BACK" : "MAKE A LITTLE WISH"}
        </p>
        <span className="auth-scene__date">
          {today.monthEn} {today.day}
        </span>
      </div>

      <div className="auth-scene__quote">
        <p>有些日子，</p>
        <p>值得被人<em>轻轻记住</em>。</p>
      </div>

      <div className="auth-scene__art" aria-hidden="true">
        <CakeArt />
      </div>

      <div className="auth-scene__foot">
        <p className="auth-scene__whisper">只展示今天，不多打扰。</p>
        <p className="auth-scene__meta">
          {today.monthZh} {today.day} 日 · {today.weekday}
        </p>
      </div>
    </section>
  );
}
