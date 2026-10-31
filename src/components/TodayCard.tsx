import { CakeArt } from "@/components/CakeArt";
import type { Today } from "@/lib/birthday";

export function TodayCard({
  today,
  count
}: {
  today: Today;
  count: number;
}) {
  return (
    <aside className="today-card" aria-label={`今天是${today.monthZh}${today.day}日，${today.weekday}`}>
      <div className="today-card__top">
        <span className="today-card__eyebrow">TODAY</span>
        <span className="today-card__year">{today.year}</span>
      </div>

      <div className="today-card__date">
        <strong className="today-card__number">{today.day}</strong>
        <div className="today-card__date-meta">
          <span className="today-card__month-en">{today.monthEn}</span>
          <span>{today.monthZh}</span>
          <span>{today.weekday}</span>
        </div>
      </div>

      <div className="today-card__art">
        <CakeArt />
      </div>

      <div className="today-card__foot">
        <p className="today-card__quote">有人降生，世界就多了一点甜。</p>
        <p className="today-card__count">
          今天 <strong>{count}</strong> 个生日
        </p>
      </div>
    </aside>
  );
}
