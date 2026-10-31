import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="BirtHappy 首页">
      <span className="brand__seal" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="15" fill="currentColor" />
          <path
            d="M16 23.5c-3.8 0-6.8-2.6-6.8-5.9v-2.1c0-1.3 1.1-2.4 2.4-2.4h8.8c1.3 0 2.4 1.1 2.4 2.4v2.1c0 3.3-3 5.9-6.8 5.9Z"
            fill="#fbf7f0"
          />
          <path
            d="M16 13.5v-3"
            stroke="#fbf7f0"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M16 9.7c-1.7-1.8-1.6-3.7 0-5.5 1.6 1.8 1.7 3.7 0 5.5Z"
            fill="#d97757"
          />
        </svg>
      </span>
      <span className="brand__word">
        Birt<span>Happy</span>
      </span>
    </Link>
  );
}
