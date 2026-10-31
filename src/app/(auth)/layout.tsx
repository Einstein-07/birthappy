import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function AuthLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="auth-frame">
      <header className="auth-header shell">
        <Logo />
        <Link className="auth-header__back" href="/">
          回到首页
        </Link>
      </header>
      <main className="auth-main">{children}</main>
      <footer className="auth-footer">
        <p>把一块蛋糕，送给今天的主角。</p>
        <p>BirtHappy · 以北京时间迎接每一个生日</p>
      </footer>
    </div>
  );
}
