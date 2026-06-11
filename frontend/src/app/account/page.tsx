"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  changePassword,
  getMe,
  getToken,
  updateProfile,
  type Me,
} from "@/lib/api";

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getMe()
      .then(setMe)
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!me) {
    return <div className="max-w-2xl mx-auto card text-center py-16 text-white/50">Loading…</div>;
  }

  const fullName = [me.first_name, me.last_name].filter(Boolean).join(" ");
  const initial = (me.first_name || me.username).charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="flex items-center gap-4">
        <span className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand to-brand-dark text-white text-xl font-semibold shadow-lg shadow-brand/30">
          {initial}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">
            {fullName || me.username}
          </h1>
          <p className="text-white/50 text-sm">
            @{me.username} · {me.is_admin ? "Administrator" : "Member"}
          </p>
        </div>
      </header>

      <ProfileCard me={me} onSaved={setMe} />
      <PasswordCard />
    </div>
  );
}

function ProfileCard({ me, onSaved }: { me: Me; onSaved: (m: Me) => void }) {
  const [first, setFirst] = useState(me.first_name || "");
  const [last, setLast] = useState(me.last_name || "");
  const [email, setEmail] = useState(me.email || "");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const dirty =
    first !== (me.first_name || "") ||
    last !== (me.last_name || "") ||
    email !== (me.email || "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    setBusy(true);
    try {
      const updated = await updateProfile({
        first_name: first.trim() || null,
        last_name: last.trim() || null,
        email: email.trim() || null,
      });
      onSaved(updated);
      setOk(true);
    } catch (ex: any) {
      setErr(ex.message || "Couldn't save profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <h2 className="font-semibold">Profile</h2>
        <p className="text-sm text-white/50 mt-0.5">Your name and contact email.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">First name</label>
          <input
            className="input"
            value={first}
            onChange={(e) => { setFirst(e.target.value); setOk(false); }}
            placeholder="Jordan"
            maxLength={120}
          />
        </div>
        <div>
          <label className="label">Last name</label>
          <input
            className="input"
            value={last}
            onChange={(e) => { setLast(e.target.value); setOk(false); }}
            placeholder="Rivera"
            maxLength={120}
          />
        </div>
      </div>

      <div>
        <label className="label">Email</label>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setOk(false); }}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>

      {err && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300 flex items-start gap-2">
          <span>⚠</span><span>{err}</span>
        </div>
      )}
      {ok && (
        <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-sm text-emerald-300">
          Profile saved.
        </div>
      )}

      <div className="flex items-center gap-3">
        <button disabled={busy || !dirty} className="btn-primary" type="submit">
          {busy ? "Saving…" : "Save changes"}
        </button>
        {!dirty && !ok && <span className="text-xs text-white/40">No changes yet.</span>}
      </div>
    </form>
  );
}

function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

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
    <form onSubmit={submit} className="card space-y-4">
      <div>
        <h2 className="font-semibold">Password</h2>
        <p className="text-sm text-white/50 mt-0.5">Use a strong, unique password.</p>
      </div>

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
      <div className="grid sm:grid-cols-2 gap-4">
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
  );
}
