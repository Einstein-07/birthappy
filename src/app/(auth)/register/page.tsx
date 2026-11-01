import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthScene } from "@/components/AuthScene";
import { safeNextPath } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getToday } from "@/lib/birthday";
import { createFormToken } from "@/lib/form-token";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "写下我的生日",
  robots: { index: false, follow: false }
};

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next, "/me");
  const user = await getCurrentUser();
  if (user) redirect(nextPath);

  return (
    <div className="auth-page shell">
      <AuthScene mode="register" />
      <section className="auth-panel auth-panel--register">
        <div className="auth-panel__inner">
          <p className="eyebrow">A SMALL DAY, KEPT SAFELY</p>
          <h1>把你的生日，<br />留在这里。</h1>
          <p className="auth-panel__lede">
            用常用邮箱完成验证。之后，你可以慢慢补充头像和简介。
          </p>
          <AuthForm
            mode="register"
            nextPath={nextPath}
            todayIso={getToday().iso}
            formToken={createFormToken("register")}
          />
        </div>
      </section>
    </div>
  );
}
