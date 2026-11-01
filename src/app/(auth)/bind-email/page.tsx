import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthScene } from "@/components/AuthScene";
import { BindEmailForm } from "@/components/BindEmailForm";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "绑定邮箱",
  robots: { index: false, follow: false }
};

export default async function BindEmailPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");
  if (user.email) redirect("/me");

  return (
    <div className="auth-page shell">
      <AuthScene mode="login" />
      <section className="auth-panel">
        <div className="auth-panel__inner">
          <p className="eyebrow">ONE SMALL STEP</p>
          <h1>绑定邮箱，<br />继续被记住。</h1>
          <p className="auth-panel__lede">
            你的旧账号仍然保留。绑定邮箱后，可以用邮箱或 UID 登录，也可以申请注销账号。
          </p>
          <BindEmailForm uid={user.uid} />
        </div>
      </section>
    </div>
  );
}
