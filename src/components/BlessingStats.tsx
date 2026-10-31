"use client";

import { useState } from "react";
import type { BlessingStats as BlessingStatsData } from "@/lib/types";

type Selection = "all" | number;

export function BlessingStats({ stats }: { stats: BlessingStatsData }) {
  const [selected, setSelected] = useState<Selection>("all");
  const selectedYear =
    selected === "all"
      ? null
      : stats.years.find((item) => item.year === selected) ?? null;
  const current = selectedYear ?? {
    year: null,
    total: stats.total,
    wishes: stats.wishes,
    shares: stats.shares
  };
  const label = selectedYear ? `${selectedYear.year} 年` : "全部";

  return (
    <section className="blessing-card" aria-labelledby="blessing-heading">
      <div className="panel-heading panel-heading--compact">
        <div>
          <p className="eyebrow">BLESSINGS RECEIVED</p>
          <h2 id="blessing-heading">我收到了多少祝福</h2>
        </div>
        <span className="blessing-card__mark" aria-hidden="true">
          {String(stats.total).padStart(2, "0")}
        </span>
      </div>

      <div className="blessing-card__number-row">
        <div className="blessing-card__number" key={`${selected}-${current.total}`}>
          <strong>{current.total}</strong>
          <span>份心意</span>
        </div>
        <span className="blessing-card__period">{label}</span>
      </div>

      <div className="blessing-card__breakdown">
        <span>
          生日蛋糕 <strong>{current.wishes}</strong>
        </span>
        <span className="blessing-card__divider" aria-hidden="true" />
        <span>
          回礼 <strong>{current.shares}</strong>
        </span>
      </div>

      {stats.years.length > 0 ? (
        <div className="year-filter" aria-label="按年份筛选祝福">
          <button
            type="button"
            className={`year-chip${selected === "all" ? " is-active" : ""}`}
            onClick={() => setSelected("all")}
            aria-pressed={selected === "all"}
          >
            全部
          </button>
          {stats.years.map((item) => (
            <button
              key={item.year}
              type="button"
              className={`year-chip${selected === item.year ? " is-active" : ""}`}
              onClick={() => setSelected(item.year)}
              aria-pressed={selected === item.year}
            >
              {item.year}
              <span>{item.total}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p className="blessing-card__note">
        {current.total > 0
          ? "来自首页的生日蛋糕，与朋友切蛋糕时回赠的那一片。"
          : "还没有收到祝福。别急，今天还长。"}
      </p>
    </section>
  );
}
