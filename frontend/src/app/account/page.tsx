"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { changePassword, getMe, getToken, type Me } from "@/lib/api";

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getMe()
      .then(setMe)
      .catch(() => router.replace("/login"));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    if (next !== confirm) {
      setErr("New passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      setOk(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (ex: any) {
      setErr(ex.message || "Couldn't change password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
        <p className="text-white/50 mt-1 text-sm">Manage your profile and password.</p>
      </header>

      {me && (
        <div className="card !p-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="label">Username</div>
              <div className="font-medium">{me.username}</div>
            </div>
            <div>
              <div className="label">Role</div>
              <div className="font-medium">{me.is_admin ? "Admin" : "Member"}</div>
            </div>
            {me.email && (
              <div className="col-span-2">
                <div className="label">Email</div>
                <div className="font-medium">{me.email}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="font-semibold mb-4">Change password</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Current password</label>
            <input
              className="input"
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input
              className="input"
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </div>
          {err && (
            <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300 flex items-start gap-2">
              <span>⚠</span><span>{err}</span>
            </div>
          )}
          {ok && (
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-sm text-emerald-300">
              Password updated.
            </div>
          )}
          <button disabled={busy} className="btn-primary" type="submit">
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
