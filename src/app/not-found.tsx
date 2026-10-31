import Link from "next/link";
import { CakeArt } from "@/components/CakeArt";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="status-page">
      <div className="status-page__card">
        <Logo />
        <p className="eyebrow">A PAGE THAT WANDERED OFF</p>
        <h1>这一页，好像去吃蛋糕了。</h1>
        <p className="status-page__lede">
          你要找的页面不在这里。回到首页，看看今天是谁的生日。
        </p>
        <div className="status-page__art" aria-hidden="true">
          <CakeArt />
        </div>
        <Link className="button button--primary" href="/">
          回到首页
        </Link>
      </div>
    </div>
  );
}
