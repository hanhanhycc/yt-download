"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import { APP_NAME, MediaMark } from "@/components/brand";

export default function LoginPage() {
  const router = useRouter();
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(u, p);
      router.push("/");
    } catch (ex: any) {
      setErr(ex.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-6">
      <div className="card animate-fade-up">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg shadow-brand/30 mb-3">
            <MediaMark className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-white/50 mt-1">Sign in to {APP_NAME}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              className="input"
              value={u}
              onChange={(e) => setU(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              className="input"
              type="password"
              value={p}
              onChange={(e) => setP(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {err && (
            <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300 flex items-start gap-2 animate-fade-up">
              <span>⚠</span><span>{err}</span>
            </div>
          )}
          <button disabled={busy} className="btn-primary w-full" type="submit">
            {busy ? (
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Signing in
              </span>
            ) : "Sign in →"}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-white/[0.06] text-sm text-white/50 text-center">
          No account?{" "}
          <Link href="/register" className="text-brand-light hover:underline underline-offset-4">
            Sign up with an invite code
          </Link>
        </div>
      </div>
    </div>
  );
}
