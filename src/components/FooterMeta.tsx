import packageJson from "../../package.json";
import { getUserCount } from "@/lib/repository";

export async function FooterMeta() {
  let count: number | null = null;
  try {
    count = await getUserCount();
  } catch {
    count = null;
  }

  return (
    <span className="footer-meta">
      {count != null ? (
        <span className="footer-meta__item">
          共 <strong>{count}</strong> 位注册用户
        </span>
      ) : null}
      {count != null ? (
        <span className="footer-meta__divider" aria-hidden="true">
          ·
        </span>
      ) : null}
      <span className="footer-meta__item footer-meta__version">
        v{packageJson.version}
      </span>
    </span>
  );
}
