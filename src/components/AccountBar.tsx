import { LogoutButton } from "@/components/LogoutButton";

export function AccountBar({ account }: { account: string }) {
  return (
    <div className="account-bar">
      <div>
        <p className="account-bar__label">登录账号</p>
        <p className="account-bar__value">@{account}</p>
      </div>
      <p className="account-bar__note">
        账号和生日年份不会公开。请妥善保存密码，本站暂不提供找回密码。
      </p>
      <LogoutButton />
    </div>
  );
}
