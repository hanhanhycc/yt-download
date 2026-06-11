"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminUser,
  Invite,
  adminCreateInvite,
  adminCreateUser,
  adminDeleteInvite,
  adminListInvites,
  adminListUsers,
  adminResetPassword,
  adminSetActive,
  getMe,
  getToken,
} from "@/lib/api";

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<"users" | "invites">("users");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getMe()
      .then((u) => {
        if (!u.is_admin) router.replace("/");
        else setAuthorized(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!authorized) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
          <p className="text-white/50 mt-1 text-sm">Manage members and invite codes.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("users")}
            className={`pill ${tab === "users" ? "pill-active" : ""}`}
          >
            Members
          </button>
          <button
            onClick={() => setTab("invites")}
            className={`pill ${tab === "invites" ? "pill-active" : ""}`}
          >
            Invite codes
          </button>
        </div>
      </header>

      {tab === "users" ? <UsersPanel /> : <InvitesPanel />}
    </div>
  );
}

function UsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setUsers(await adminListUsers());
    } catch (ex: any) {
      setError(ex.message || "Failed to load users");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminCreateUser({
        username: username.trim(),
        password,
        email: email.trim() || undefined,
        is_admin: isAdmin,
      });
      setUsername("");
      setEmail("");
      setPassword("");
      setIsAdmin(false);
      setCreating(false);
      await load();
    } catch (ex: any) {
      setError(ex.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onReset(u: AdminUser) {
    const pw = prompt(`New password for "${u.username}" (min 6 chars):`);
    if (!pw) return;
    try {
      await adminResetPassword(u.id, pw);
      alert("Password reset.");
    } catch (ex: any) {
      alert(ex.message || "Reset failed");
    }
  }

  async function onToggleActive(u: AdminUser) {
    try {
      await adminSetActive(u.id, !u.is_active);
      await load();
    } catch (ex: any) {
      alert(ex.message || "Update failed");
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button className="btn-primary !py-1.5 !px-3 !text-sm" onClick={() => setCreating((v) => !v)}>
          {creating ? "Cancel" : "+ New member"}
        </button>
      </div>

      {creating && (
        <form onSubmit={onCreate} className="card !p-5 grid sm:grid-cols-2 gap-4 animate-fade-up">
          <div>
            <label className="label">Username</label>
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} minLength={3} required />
          </div>
          <div>
            <label className="label">Email <span className="text-white/30">(optional)</span></label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
              <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
              Admin
            </label>
            <button disabled={busy} className="btn-primary ml-auto" type="submit">
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-3">
        {users.map((u) => (
          <div key={u.id} className="card !p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {u.username}
                {u.is_admin && <span className="badge border bg-brand/15 text-brand-light border-brand/30">admin</span>}
                {!u.is_active && <span className="badge border bg-white/10 text-white/60 border-white/20">disabled</span>}
              </div>
              <div className="text-xs text-white/50 mt-1">
                {u.email || "no email"} · {u.job_count} downloads · joined {fmtDate(u.created_at)}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button className="btn-ghost !py-1.5 !px-3 !text-xs" onClick={() => onReset(u)}>
                Reset password
              </button>
              <button className="btn-ghost !py-1.5 !px-3 !text-xs" onClick={() => onToggleActive(u)}>
                {u.is_active ? "Disable" : "Enable"}
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="card text-center py-12 text-white/50">No members yet.</div>
        )}
      </div>
    </div>
  );
}

function InvitesPanel() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresIn, setExpiresIn] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setInvites(await adminListInvites());
    } catch (ex: any) {
      setError(ex.message || "Failed to load invites");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminCreateInvite({
        max_uses: maxUses,
        expires_in_days: expiresIn ? Number(expiresIn) : null,
      });
      await load();
    } catch (ex: any) {
      setError(ex.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this invite code?")) return;
    try {
      await adminDeleteInvite(id);
      setInvites((xs) => xs.filter((i) => i.id !== id));
    } catch (ex: any) {
      alert(ex.message || "Delete failed");
    }
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(
      () => {},
      () => {}
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={onCreate} className="card !p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Max uses</label>
          <input
            className="input !w-28"
            type="number"
            min={1}
            max={1000}
            value={maxUses}
            onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <div>
          <label className="label">Expires in (days) <span className="text-white/30">opt.</span></label>
          <input
            className="input !w-36"
            type="number"
            min={1}
            placeholder="never"
            value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value)}
          />
        </div>
        <button disabled={busy} className="btn-primary" type="submit">
          {busy ? "Generating…" : "Generate code"}
        </button>
      </form>

      <div className="grid gap-3">
        {invites.map((inv) => (
          <div key={inv.id} className="card !p-4 flex items-center gap-4">
            <button
              onClick={() => copy(inv.code)}
              title="Click to copy"
              className="font-mono text-lg tracking-widest text-brand-light hover:text-white transition"
            >
              {inv.code}
            </button>
            <div className="flex-1 min-w-0 text-xs text-white/50">
              {inv.used_count}/{inv.max_uses} used
              {inv.is_exhausted && <span className="ml-2 text-amber-300">exhausted</span>}
              {inv.expires_at && <span> · expires {fmtDate(inv.expires_at)}</span>}
              <span> · created {fmtDate(inv.created_at)}</span>
            </div>
            <button className="btn-ghost !py-1.5 !px-3 !text-xs shrink-0" onClick={() => onDelete(inv.id)}>
              Delete
            </button>
          </div>
        ))}
        {invites.length === 0 && (
          <div className="card text-center py-12 text-white/50">
            No invite codes yet. Generate one above.
          </div>
        )}
      </div>
    </div>
  );
}
