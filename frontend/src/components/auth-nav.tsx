"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_BASE, getToken, setToken } from "@/lib/api";

/**
 * Header auth control.
 *
 * - If the backend runs in open mode (AUTH_REQUIRED=false) it renders
 *   nothing — there's no login to show.
 * - Otherwise it reflects the real login state: "Sign in" when logged out,
 *   "Sign out" when a token is present.
 */
export function AuthNav() {
  const [authRequired, setAuthRequired] = useState<boolean | null>(null);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const sync = () => setAuthed(!!getToken());
    sync();
    window.addEventListener("storage", sync);

    fetch(`${API_BASE}/api/config`)
      .then((r) => r.json())
      .then((c) => setAuthRequired(!!c.auth_required))
      .catch(() => setAuthRequired(true)); // fail safe: assume login exists

    return () => window.removeEventListener("storage", sync);
  }, []);

  // Open mode (or while we don't know yet): show nothing.
  if (authRequired !== true) return null;

  if (!authed) {
    return (
      <Link
        href="/login"
        className="btn-ghost ml-2 !py-1.5 !px-3 !text-sm whitespace-nowrap"
      >
        Sign in
      </Link>
    );
  }

  return (
    <button
      onClick={() => {
        setToken(null);
        window.location.href = "/login";
      }}
      className="btn-ghost ml-2 !py-1.5 !px-3 !text-sm whitespace-nowrap"
    >
      Sign out
    </button>
  );
}
