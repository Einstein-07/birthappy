import Link from "next/link";
import { FooterMeta } from "@/components/FooterMeta";
import { Logo } from "@/components/Logo";

export default function AuthLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const year = new Date().getFullYear();

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
        <div className="auth-footer__meta">
          <p>
            © {year} 绛河 · BirtHappy · 以北京时间迎接每一个生日
          </p>
          <FooterMeta />
        </div>
      </footer>
    </div>
  );
}
