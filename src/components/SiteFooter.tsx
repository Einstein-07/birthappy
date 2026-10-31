export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner shell">
        <p className="site-footer__note">
          把一块蛋糕，送给今天的主角。
        </p>
        <p className="site-footer__meta">
          © {year} 绛河 <span aria-hidden="true">·</span> BirtHappy
          <span aria-hidden="true"> · </span>
          以北京时间迎接每一个生日
        </p>
      </div>
    </footer>
  );
}
