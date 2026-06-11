import Link from "next/link";

export const APP_NAME = "Media Download";
export const APP_TAGLINE = "Download anything from 1000+ sites.";
export const REPO_URL = "https://github.com/hanhanhycc/yt-download";

/**
 * The Media Download mark: a downward "play" triangle landing on a tray —
 * media (play) + download, in one glyph. Rendered white on a brand gradient
 * tile by <Logo>.
 */
export function MediaMark({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {/* downward play triangle = media being pulled down */}
      <path d="M7 3.5h10a1 1 0 0 1 .82 1.57l-5 7.2a1 1 0 0 1-1.64 0l-5-7.2A1 1 0 0 1 7 3.5Z" fill="currentColor" />
      {/* tray / baseline = download target */}
      <path d="M5 19.5h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/**
 * App logo: gradient tile + wordmark. `compact` drops the wordmark (icon only).
 */
export function Logo({
  href = "/",
  compact = false,
}: {
  href?: string | null;
  compact?: boolean;
}) {
  const inner = (
    <>
      <span className="relative inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg shadow-brand/30 transition group-hover:shadow-brand/50 group-hover:scale-[1.04]">
        <MediaMark className="w-5 h-5" />
      </span>
      {!compact && (
        <span className="font-semibold tracking-tight text-[15px] whitespace-nowrap">
          {APP_NAME}
        </span>
      )}
    </>
  );

  if (href === null) {
    return <span className="flex items-center gap-2.5 group">{inner}</span>;
  }
  return (
    <Link href={href} className="flex items-center gap-2.5 group shrink-0">
      {inner}
    </Link>
  );
}

export function HeartIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 21s-7.5-4.6-10-9.3C.4 8.3 1.9 4.5 5.5 4.5c2 0 3.4 1.1 4.5 2.6 1.1-1.5 2.5-2.6 4.5-2.6 3.6 0 5.1 3.8 3.5 7.2C19.5 16.4 12 21 12 21Z" />
    </svg>
  );
}
