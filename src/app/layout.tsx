import type { Metadata, Viewport } from "next";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BirtHappy｜把一块蛋糕，送给今天的主角",
    template: "%s｜BirtHappy"
  },
  description:
    "BirtHappy 只展示今天过生日的人。送一块蛋糕，让被记住这件事轻一点，也暖一点。",
  applicationName: "BirtHappy",
  authors: [{ name: "绛河" }],
  creator: "绛河",
  keywords: ["生日", "祝福", "蛋糕", "BirtHappy"],
  openGraph: {
    title: "BirtHappy｜把一块蛋糕，送给今天的主角",
    description: "今天，世界为你甜了一点。",
    type: "website",
    locale: "zh_CN",
    siteName: "BirtHappy"
  },
  twitter: {
    card: "summary",
    title: "BirtHappy｜把一块蛋糕，送给今天的主角",
    description: "今天，世界为你甜了一点。"
  },
  robots: {
    index: true,
    follow: true
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f4ed",
  colorScheme: "light"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="ambient" aria-hidden="true">
          <span className="ambient__glow ambient__glow--one" />
          <span className="ambient__glow ambient__glow--two" />
          <span className="ambient__grain" />
        </div>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
