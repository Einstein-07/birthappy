import type { Metadata } from "next";
import Link from "next/link";
import { BirthdayList } from "@/components/BirthdayList";
import { CakeArt } from "@/components/CakeArt";
import { TodayCard } from "@/components/TodayCard";
import {
  ArrowIcon,
  ArrowUpRightIcon,
  CakeSliceIcon
} from "@/components/Icons";
import { getCurrentUser } from "@/lib/auth";
import {
  formatTodayLong,
  getToday,
  isBirthdayToday
} from "@/lib/birthday";
import { getTodayBirthdayPeople } from "@/lib/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "今天，世界为你甜了一点"
};

export default async function HomePage() {
  const today = getToday();
  const user = await getCurrentUser();
  const people = await getTodayBirthdayPeople(user?.id ?? null, today);
  const isOwnBirthday = user ? isBirthdayToday(user.birthday, today) : false;
  const count = people.length;

  return (
    <div className="home-page">
      <section className="hero shell">
        <div className="hero__copy reveal">
          <p className="eyebrow">
            <span className="eyebrow__dot" aria-hidden="true" />
            BIRTHDAY, TODAY
          </p>
          <h1 className="hero__title">
            今天，世界
            <br />
            为你<em>甜</em>了一点。
          </h1>
          <p className="hero__lede">
            {count > 0 ? (
              <>
                今天有 <strong>{count}</strong> 位朋友过生日。送一块蛋糕，让今天被记得，轻一点，也暖一点。
              </>
            ) : (
              <>
                今天还没有人在这里过生日。也许，下一个被记住的日子，就是你的。
              </>
            )}
          </p>
          <p className="hero__date">{formatTodayLong(today)}</p>

          {!user ? (
            <div className="hero__actions">
              <Link className="button button--primary" href="/register">
                写下我的生日
                <ArrowIcon className="button__icon" />
              </Link>
              <Link className="quiet-link" href="/login?next=/">
                已有账号，登录
              </Link>
            </div>
          ) : isOwnBirthday ? (
            <div className="hero__actions">
              <Link className="button button--primary" href="/me">
                去看看我的祝福
                <ArrowIcon className="button__icon" />
              </Link>
              <span className="hero__whisper">今天也是你的生日。</span>
            </div>
          ) : (
            <p className="hero__signed">
              以 <span>{user.isAnonymous ? "匿名的朋友" : user.name}</span> 的身份，送出今天的祝福。
            </p>
          )}
        </div>

        <div className="hero__visual reveal reveal--delay">
          <TodayCard today={today} count={count} />
        </div>
      </section>

      <div className="shell">
        {isOwnBirthday && user ? (
          <Link className="self-banner" href="/me">
            <span className="self-banner__icon" aria-hidden="true">
              <CakeSliceIcon />
            </span>
            <span className="self-banner__copy">
              <span className="self-banner__eyebrow">今天也是你的生日</span>
              <span className="self-banner__title">
                你的小小宇宙正在发光。去看看收到了多少祝福，或者为大家切一块蛋糕。
              </span>
            </span>
            <ArrowUpRightIcon className="self-banner__arrow" />
          </Link>
        ) : null}

        <section className="birthday-panel" aria-labelledby="today-people">
          <div className="section-heading">
            <div>
              <p className="eyebrow">THE BIRTHDAY TABLE</p>
              <h2 id="today-people">今天生日的人</h2>
            </div>
            <div className="section-heading__count" aria-label={`${count} 位`}>
              <span>{String(count).padStart(2, "0")}</span>
              <small>位</small>
            </div>
          </div>

          {count > 0 ? (
            <BirthdayList people={people} authenticated={Boolean(user)} />
          ) : (
            <div className="birthday-empty">
              <div className="birthday-empty__art" aria-hidden="true">
                <CakeArt />
              </div>
              <h3>今天还没有人坐在这张桌子旁。</h3>
              <p>
                如果你愿意，可以把自己的今天留在这里。或者，等一位朋友出现。
              </p>
              {!user ? (
                <div className="birthday-empty__actions">
                  <Link className="button button--primary" href="/register">
                    创建我的资料
                    <ArrowIcon className="button__icon" />
                  </Link>
                  <Link className="quiet-link" href="/login?next=/">
                    我已有账号
                  </Link>
                </div>
              ) : (
                <Link className="quiet-link" href="/me">
                  去完善我的生日
                </Link>
              )}
            </div>
          )}
        </section>

        {!user && count > 0 ? (
          <aside className="join-strip">
            <div>
              <p className="join-strip__title">也想让自己的今天被记住？</p>
              <p className="join-strip__note">
                生日只展示月和日；头像、称呼和简介都可以随时修改。
              </p>
            </div>
            <Link className="join-strip__link" href="/register">
              留下我的生日
              <ArrowIcon />
            </Link>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
