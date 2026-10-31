import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function MainLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="site-frame">
      <SiteHeader />
      <main className="page-main">{children}</main>
      <SiteFooter />
    </div>
  );
}
