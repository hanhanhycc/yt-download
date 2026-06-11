"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getMe, getToken, setToken, type Me } from "@/lib/api";

/**
 * Header auth control.
 *
 * Works in both modes:
 * - Logged out: "Sign in" + "Sign up" links (members can register with an
 *   invite code; anonymous visitors can still use the app in open mode).
 * - Logged in: "Account" (+ "Admin" for admins) and "Sign out".
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
        .then((u) => {
          if (!cancelled) setMe(u);
        })
        .catch(() => {
          if (!cancelled) setMe(null);
        })
        .finally(() => {
          if (!cancelled) setReady(true);
        });
    };
    sync();
    window.addEventListener("storage", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!ready) return null;

  if (!me) {
    return (
      <div className="flex items-center gap-1">
        <Link
          href="/login"
          className="btn-ghost ml-2 !py-1.5 !px-3 !text-sm whitespace-nowrap"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="btn-primary !py-1.5 !px-3 !text-sm whitespace-nowrap"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {me.is_admin && (
        <Link
          href="/admin"
          className="text-sm text-white/60 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/5 whitespace-nowrap"
        >
          Admin
        </Link>
      )}
      <Link
        href="/account"
        className="text-sm text-white/80 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-white/5 whitespace-nowrap"
      >
        {me.username}
      </Link>
      <button
        onClick={() => {
          setToken(null);
          window.location.href = "/";
        }}
        className="btn-ghost ml-1 !py-1.5 !px-3 !text-sm whitespace-nowrap"
      >
        Sign out
      </button>
    </div>
  );
}
