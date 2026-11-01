import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountBar } from "@/components/AccountBar";
import { BlessingStats } from "@/components/BlessingStats";
import { CutCake } from "@/components/CutCake";
import { OtherSection } from "@/components/OtherSection";
import { ProfileEditor } from "@/components/ProfileEditor";
import { getCurrentUser } from "@/lib/auth";
import {
  formatBirthdayShort,
  getToday,
  isBirthdayToday
} from "@/lib/birthday";
import {
  getBlessingStats,
  getChangeQuotaState,
  getPendingWishCount
} from "@/lib/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "我",
  robots: { index: false, follow: false }
};

export default async function MePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");

  const today = getToday();
  const [stats, pending, quota] = await Promise.all([
    getBlessingStats(user.id),
    getPendingWishCount(user.id),
    getChangeQuotaState(user)
  ]);
  const birthdayToday = isBirthdayToday(user.birthday, today);

  return (
    <div className="me-page shell">
      <header className="me-hero reveal">
        <div className="me-hero__copy">
          <p className="eyebrow">
            <span className="eyebrow__dot" aria-hidden="true" />
            MY LITTLE UNIVERSE
          </p>
          <h1>
            {user.name}，
            <br />
            把今天，留给自己。
          </h1>
          <p className="me-hero__lede">
            {birthdayToday
              ? "今天，世界为你甜了一点。去看看朋友们留下的心意吧。"
              : `你的生日在 ${formatBirthdayShort(user.birthday)}。今天先来坐一会儿，也很好。`}
          </p>
        </div>
        <div className="me-hero__aside">
          {birthdayToday ? (
            <span className="birthday-today-tag">
              <span aria-hidden="true">✦</span>
              今天生日
            </span>
          ) : null}
          <p className="me-hero__date">
            {today.monthEn} {today.day}
          </p>
          <p className="me-hero__month">
            {today.monthZh} · {today.weekday}
          </p>
        </div>
      </header>

      <div className="me-grid">
        <div className="me-grid__main">
          <ProfileEditor user={user} todayIso={today.iso} quota={quota} />
          <AccountBar user={user} />
          <OtherSection email={user.email} />
        </div>
        <aside className="me-grid__side">
          <BlessingStats stats={stats} />
          <CutCake initialPending={pending} />
        </aside>
      </div>
    </div>
  );
}
