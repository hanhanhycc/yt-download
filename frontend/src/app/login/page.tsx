"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [u, setU] = useState("admin");
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
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-brand to-brand-dark shadow-lg shadow-brand/30 mb-3">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-white/50 mt-1">Sign in to your Loom account</p>
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

        <div className="mt-6 pt-4 border-t border-white/[0.06] text-xs text-white/40 text-center">
          Tip: the bootstrap admin defaults to{" "}
          <code className="text-white/70 bg-white/5 px-1.5 py-0.5 rounded">admin / admin</code>
        </div>
      </div>
    </div>
  );
}
