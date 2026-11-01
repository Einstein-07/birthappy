import Link from "next/link";
import { UidEditor } from "@/components/UidEditor";
import { LogoutButton } from "@/components/LogoutButton";
import type { User } from "@/lib/types";

export function AccountBar({ user }: { user: User }) {
  return (
    <section className="account-bar" aria-labelledby="account-heading">
      <div className="account-bar__head">
        <div>
          <p className="eyebrow">ACCOUNT</p>
          <h2 id="account-heading">账号与标识</h2>
        </div>
        <LogoutButton />
      </div>

      <div className="account-bar__identity">
        <div>
          <p className="account-bar__label">登录邮箱</p>
          {user.email ? (
            <p className="account-bar__value">{user.email}</p>
          ) : (
            <p className="account-bar__value account-bar__value--missing">
              尚未绑定
            </p>
          )}
        </div>
        <div className="account-bar__uid">
          <UidEditor
            initialUid={user.uid}
            initialChangeCount={user.uidChangeCount}
          />
        </div>
      </div>

      {!user.email ? (
        <div className="account-bar__alert" role="status">
          <span>
            旧账号需要绑定邮箱后才能使用邮箱登录和注销验证。
          </span>
          <Link href="/bind-email">去绑定邮箱</Link>
        </div>
      ) : null}

      <p className="account-bar__note">
        UID 和邮箱不会公开展示。请妥善保存密码，本站暂不提供找回密码。
      </p>
    </section>
  );
}
