"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getMe, getToken, setToken, type Me } from "@/lib/api";

/**
 * Header auth control.
 *
 * - Logged out: a single "Log in" button. The login page itself offers the
 *   "create an account" path, so the header stays uncluttered.
 * - Logged in: a compact account button that opens a menu (Account, Admin for
 *   admins, Sign out) — no duplicate username/Admin labels in the nav bar.
 *
 * Reacts to `auth-changed` (same tab) and `storage` (other tabs) so it updates
 * the moment you log in, with no page refresh.
 */
export function AuthNav() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sync = () => {
      if (!getToken()) {
        if (!cancelled) {
          setMe(null);
          setReady(true);
        }
        return;
      }
      getMe()
        .then((u) => !cancelled && setMe(u))
        .catch(() => !cancelled && setMe(null))
        .finally(() => !cancelled && setReady(true));
    };
    sync();
    window.addEventListener("auth-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("auth-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!ready) {
    // Reserve width so the header doesn't shift when state resolves.
    return <div className="ml-2 w-[84px] h-9" aria-hidden />;
  }

  if (!me) {
    return (
      <Link href="/login" className="btn-primary ml-2 !py-1.5 !px-4 !text-sm whitespace-nowrap">
        Log in
      </Link>
    );
  }

  return <AccountMenu me={me} />;
}

function AccountMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = me.username.charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative ml-2">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] py-1.5 pl-1.5 pr-2.5 transition"
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white text-xs font-semibold">
          {initial}
        </span>
        <span className="text-sm font-medium max-w-[120px] truncate">{me.username}</span>
        <svg
          viewBox="0 0 24 24"
          className={`w-3.5 h-3.5 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-[#0d0d16]/95 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/60 animate-fade-up z-30"
        >
          <div className="px-3 py-2 border-b border-white/[0.06] mb-1">
            <div className="text-sm font-medium truncate">{me.username}</div>
            <div className="text-xs text-white/40">
              {me.is_admin ? "Administrator" : "Member"}
            </div>
          </div>

          <MenuLink href="/account" onClick={() => setOpen(false)} icon={<UserIcon />}>
            Account
          </MenuLink>
          {me.is_admin && (
            <MenuLink href="/admin" onClick={() => setOpen(false)} icon={<ShieldIcon />}>
              Admin
            </MenuLink>
          )}

          <div className="my-1 border-t border-white/[0.06]" />
          <button
            role="menuitem"
            onClick={() => {
              setToken(null);
              window.location.href = "/";
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-300 hover:bg-red-400/10 transition text-left"
          >
            <LogoutIcon />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  onClick,
  icon,
  children,
}: {
  href: string;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/80 hover:bg-white/5 hover:text-white transition"
    >
      <span className="text-white/50">{icon}</span>
      {children}
    </Link>
  );
}

const iconProps = {
  className: "w-4 h-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const UserIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" />
  </svg>
);
const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" {...iconProps}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);
