"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getConfig, register } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [requireInvite, setRequireInvite] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getConfig()
      .then((c) => {
        setRequireInvite(c.registration_require_invite);
        setEnabled(c.registration_enabled);
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await register({
        username: username.trim(),
        password,
        email: email.trim() || undefined,
        invite_code: invite.trim() || undefined,
      });
      router.push("/");
    } catch (ex: any) {
      setErr(ex.message || "Registration failed");
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M19 8v6M22 11h-6" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Create your account</h1>
          <p className="text-sm text-white/50 mt-1">
            Members keep history for 30 days and links for 7 days.
          </p>
        </div>

        {!enabled ? (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-3 text-sm text-amber-200 text-center">
            Registration is currently disabled. Ask an admin to create your account.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Username</label>
              <input
                className="input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                minLength={3}
                required
              />
            </div>
            <div>
              <label className="label">Email <span className="text-white/30">(optional)</span></label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
            {requireInvite && (
              <div>
                <label className="label">Invite code</label>
                <input
                  className="input font-mono tracking-wide"
                  value={invite}
                  onChange={(e) => setInvite(e.target.value.toUpperCase())}
                  placeholder="ABCD123XYZ"
                  required
                />
                <p className="text-xs text-white/40 mt-1">
                  Ask an admin for an invite code to register.
                </p>
              </div>
            )}
            {err && (
              <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300 flex items-start gap-2 animate-fade-up">
                <span>⚠</span><span>{err}</span>
              </div>
            )}
            <button disabled={busy} className="btn-primary w-full" type="submit">
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creating account
                </span>
              ) : "Create account →"}
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-white/[0.06] text-sm text-white/50 text-center">
          Already have an account?{" "}
          <Link href="/login" className="text-brand-light hover:underline underline-offset-4">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
