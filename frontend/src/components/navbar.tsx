"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthNav } from "@/components/auth-nav";

const LINKS = [
  { href: "/", label: "New", exact: true },
  { href: "/history", label: "History" },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 group shrink-0">
      <span className="relative inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-brand to-brand-dark shadow-lg shadow-brand/30 transition group-hover:shadow-brand/50">
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

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavBar() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  // Close the mobile menu on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-black/50 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-6 min-w-0">
          <Logo />
          <nav className="hidden md:flex items-center gap-1">
            {LINKS.map((l) => {
              const active = isActive(pathname, l.href, l.exact);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`relative text-sm px-3 py-1.5 rounded-lg transition ${
                    active
                      ? "text-white bg-white/[0.06]"
                      : "text-white/60 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {l.label}
                  {active && (
                    <span className="absolute -bottom-[7px] left-3 right-3 h-0.5 rounded-full bg-gradient-to-r from-brand to-brand-light" />
                  )}
                </Link>
              );
            })}
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-white/60 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/5"
            >
              API
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <AuthNav />
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="md:hidden btn-icon ml-1"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M6 18 18 6" /> : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-white/[0.06] bg-black/70 backdrop-blur-xl animate-fade-up">
          <nav className="max-w-6xl mx-auto px-5 py-3 flex flex-col gap-1">
            {LINKS.map((l) => {
              const active = isActive(pathname, l.href, l.exact);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`text-sm px-3 py-2.5 rounded-lg transition ${
                    active ? "text-white bg-white/[0.06]" : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-white/70 hover:bg-white/5 px-3 py-2.5 rounded-lg transition"
            >
              API docs
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
