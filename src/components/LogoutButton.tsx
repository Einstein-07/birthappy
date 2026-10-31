"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";

export function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function logout() {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error();
      router.replace("/");
      router.refresh();
    } catch {
      toast("暂时没有退出成功，请稍后再试", "error");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className="text-button text-button--muted"
      onClick={logout}
      disabled={loading}
    >
      {loading ? "正在退出" : "退出登录"}
    </button>
  );
}
