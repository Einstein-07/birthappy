import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthScene } from "@/components/AuthScene";
import { safeNextPath } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getToday } from "@/lib/birthday";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录",
  robots: { index: false, follow: false }
};

export default async function LoginPage({
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
      <AuthScene mode="login" />
      <section className="auth-panel">
        <div className="auth-panel__inner">
          <p className="eyebrow">A QUIET PLACE FOR TODAY</p>
          <h1>欢迎回来。</h1>
          <p className="auth-panel__lede">
            今天也有人在等一块蛋糕。回到你的小小宇宙，看看谁记得今天。
          </p>
          <AuthForm
            mode="login"
            nextPath={nextPath}
            todayIso={getToday().iso}
          />
        </div>
      </section>
    </div>
  );
}
