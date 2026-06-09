import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Loom · Self-hosted media downloader",
  description: "A modern, self-hosted yt-dlp web app. Download from 1000+ sites.",
};

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark shadow-lg shadow-brand/30">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
      </span>
      <div className="leading-tight">
        <div className="font-semibold tracking-tight">Loom</div>
        <div className="hidden sm:block text-[10px] text-white/40 -mt-0.5 group-hover:text-white/60 transition">
          self-hosted · yt-dlp
        </div>
      </div>
    </Link>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm text-white/60 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/5"
    >
      {children}
    </Link>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-black/40 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
            <Logo />
            <nav className="flex items-center gap-1">
              <NavLink href="/">New</NavLink>
              <NavLink href="/history">History</NavLink>
              <a
                href="/docs"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex text-sm text-white/60 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/5"
              >
                API
              </a>
              <Link href="/login" className="btn-ghost ml-2 !py-1.5 !px-3 !text-sm whitespace-nowrap">
                Sign in
              </Link>
            </nav>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-5 py-10 md:py-14">{children}</main>

        <footer className="max-w-6xl mx-auto px-5 py-10 mt-10 border-t border-white/[0.06] text-xs text-white/40 flex flex-col md:flex-row items-center justify-between gap-3">
          <div>
            Built on <span className="text-white/70">yt-dlp</span> ·{" "}
            <span className="text-white/70">FastAPI</span> ·{" "}
            <span className="text-white/70">Next.js</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
            <span>All systems operational</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
