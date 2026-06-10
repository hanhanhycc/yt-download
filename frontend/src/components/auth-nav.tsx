"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken, setToken } from "@/lib/api";

/**
 * Header auth control. Reflects the real login state (token in
 * localStorage): shows "Sign in" when logged out and "Sign out" when
 * logged in. Without this the header always said "Sign in", which made a
 * successful login look like it had failed.
 */
export function AuthNav() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const sync = () => setAuthed(!!getToken());
    sync();
    // Reflect login/logout that happened in another tab.
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

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
