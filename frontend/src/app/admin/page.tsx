"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AdminJob,
  AdminStats,
  AdminUser,
  Invite,
  adminCreateInvite,
  adminCreateUser,
  adminDeleteInvite,
  adminDeleteUser,
  adminListInvites,
  adminListJobs,
  adminListUsers,
  adminResetPassword,
  adminSetActive,
  adminSetRole,
  adminStats,
  getMe,
  getToken,
} from "@/lib/api";

function fmtDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString();
}
function fmtDateTime(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString();
}
function fmtBytes(n?: number | null) {
  if (n == null) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}
function fullName(u: { first_name?: string | null; last_name?: string | null }) {
  return [u.first_name, u.last_name].filter(Boolean).join(" ");
}

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [meId, setMeId] = useState<number | null>(null);
  const [tab, setTab] = useState<"users" | "invites" | "downloads">("users");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getMe()
      .then((u) => {
        if (!u.is_admin) router.replace("/");
        else {
          setMeId(u.id);
          setAuthorized(true);
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  if (!authorized) return null;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-white/50 mt-1 text-sm">Members, invites and download activity at a glance.</p>
      </header>

      <StatsOverview />

      <div className="flex gap-2">
        <TabButton active={tab === "users"} onClick={() => setTab("users")}>Members</TabButton>
        <TabButton active={tab === "invites"} onClick={() => setTab("invites")}>Invite codes</TabButton>
        <TabButton active={tab === "downloads"} onClick={() => setTab("downloads")}>Downloads</TabButton>
      </div>

      {tab === "users" && <UsersPanel meId={meId} />}
      {tab === "invites" && <InvitesPanel />}
      {tab === "downloads" && <DownloadsPanel />}
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`pill ${active ? "pill-active" : ""}`}>
      {children}
    </button>
  );
}

/* ------------------------------- Stats ------------------------------- */

const STATUS_META: Record<string, { label: string; color: string; bar: string }> = {
  completed: { label: "Completed", color: "text-emerald-300", bar: "bg-emerald-400" },
  running: { label: "Running", color: "text-brand-light", bar: "bg-brand" },
  pending: { label: "Queued", color: "text-amber-300", bar: "bg-amber-400" },
  failed: { label: "Failed", color: "text-red-300", bar: "bg-red-400" },
  canceled: { label: "Canceled", color: "text-white/60", bar: "bg-white/30" },
};

function StatsOverview() {
  const [s, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setStats(await adminStats());
    } catch (ex: any) {
      setError(ex.message || "Failed to load stats");
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  if (error) {
    return (
      <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!s) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card !p-5 h-[92px] animate-pulse bg-white/[0.03]" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: "Members", value: s.total_members, sub: `${s.total_admins} admin${s.total_admins === 1 ? "" : "s"}`, icon: <UsersIcon /> },
    { label: "Downloads", value: s.downloads_total, sub: `${s.downloads_today} today`, icon: <DownloadIcon /> },
    { label: "Active now", value: s.downloads_active, sub: `${s.downloads_failed} failed`, icon: <PulseIcon /> },
    { label: "Storage used", value: fmtBytes(s.storage_bytes), sub: `${s.total_invites_active} live invites`, icon: <DiskIcon /> },
  ];

  const total = Object.values(s.status_breakdown).reduce((a, b) => a + b, 0);
  const order = ["completed", "running", "pending", "failed", "canceled"];
  const segments = order
    .filter((k) => s.status_breakdown[k])
    .map((k) => ({ k, n: s.status_breakdown[k] }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card !p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[0.14em] text-white/40">{c.label}</span>
              <span className="text-brand-light/80">{c.icon}</span>
            </div>
            <div className="text-2xl font-semibold mt-2 tabular-nums">{c.value}</div>
            <div className="text-xs text-white/40 mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {total > 0 && (
        <div className="card !p-5">
          <div className="text-[11px] uppercase tracking-[0.14em] text-white/40 mb-3">
            Download status
          </div>
          <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-white/[0.04]">
            {segments.map((seg) => (
              <div
                key={seg.k}
                className={STATUS_META[seg.k]?.bar || "bg-white/30"}
                style={{ width: `${(seg.n / total) * 100}%` }}
                title={`${STATUS_META[seg.k]?.label || seg.k}: ${seg.n}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
            {segments.map((seg) => (
              <span key={seg.k} className="inline-flex items-center gap-1.5 text-xs text-white/60">
                <span className={`w-2 h-2 rounded-full ${STATUS_META[seg.k]?.bar || "bg-white/30"}`} />
                {STATUS_META[seg.k]?.label || seg.k}
                <span className="text-white/40 tabular-nums">{seg.n}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Members ------------------------------- */

function UsersPanel({ meId }: { meId: number | null }) {
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
      setUsername(""); setEmail(""); setPassword(""); setIsAdmin(false);
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
    try { await adminSetActive(u.id, !u.is_active); await load(); }
    catch (ex: any) { alert(ex.message || "Update failed"); }
  }
  async function onToggleRole(u: AdminUser) {
    const verb = u.is_admin ? "Remove admin rights from" : "Grant admin rights to";
    if (!confirm(`${verb} "${u.username}"?`)) return;
    try { await adminSetRole(u.id, !u.is_admin); await load(); }
    catch (ex: any) { alert(ex.message || "Update failed"); }
  }
  async function onDelete(u: AdminUser) {
    if (!confirm(`Delete "${u.username}" and all their downloads? This cannot be undone.`)) return;
    try { await adminDeleteUser(u.id); setUsers((xs) => xs.filter((x) => x.id !== u.id)); }
    catch (ex: any) { alert(ex.message || "Delete failed"); }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300">{error}</div>
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
        {users.map((u) => {
          const name = fullName(u);
          const initial = (u.first_name || u.username).charAt(0).toUpperCase();
          return (
            <div key={u.id} className="card !p-4 flex items-center gap-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 text-sm font-semibold shrink-0">
                {initial}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  {name || u.username}
                  {name && <span className="text-white/40 text-sm font-normal">@{u.username}</span>}
                  {u.is_admin && <span className="badge border bg-brand/15 text-brand-light border-brand/30">admin</span>}
                  {!u.is_active && <span className="badge border bg-white/10 text-white/60 border-white/20">disabled</span>}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  {u.email || "no email"} · {u.job_count} downloads
                  {u.last_download_at && <> · last {fmtDate(u.last_download_at)}</>}
                  <> · joined {fmtDate(u.created_at)}</>
                </div>
              </div>
              <UserActions
                user={u}
                isSelf={u.id === meId}
                onReset={() => onReset(u)}
                onToggleActive={() => onToggleActive(u)}
                onToggleRole={() => onToggleRole(u)}
                onDelete={() => onDelete(u)}
              />
            </div>
          );
        })}
        {users.length === 0 && (
          <div className="card text-center py-12 text-white/50">No members yet.</div>
        )}
      </div>
    </div>
  );
}

function UserActions({
  user, isSelf, onReset, onToggleActive, onToggleRole, onDelete,
}: {
  user: AdminUser;
  isSelf: boolean;
  onReset: () => void;
  onToggleActive: () => void;
  onToggleRole: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button className="btn-ghost !py-1.5 !px-2.5" onClick={() => setOpen((v) => !v)} aria-label="Actions">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl border border-white/10 bg-[#0d0d16]/95 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/60 animate-fade-up z-20">
          <ActionItem onClick={onReset}>Reset password</ActionItem>
          {!isSelf && (
            <ActionItem onClick={onToggleActive}>{user.is_active ? "Disable account" : "Enable account"}</ActionItem>
          )}
          {!isSelf && (
            <ActionItem onClick={onToggleRole}>{user.is_admin ? "Remove admin" : "Make admin"}</ActionItem>
          )}
          {!isSelf && (
            <>
              <div className="my-1 border-t border-white/[0.06]" />
              <ActionItem danger onClick={onDelete}>Delete member</ActionItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ActionItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
        danger ? "text-red-300 hover:bg-red-400/10" : "text-white/80 hover:bg-white/5 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------- Invites ------------------------------- */

function InvitesPanel() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [maxUses, setMaxUses] = useState(1);
  const [expiresIn, setExpiresIn] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  async function load() {
    try { setInvites(await adminListInvites()); }
    catch (ex: any) { setError(ex.message || "Failed to load invites"); }
  }
  useEffect(() => { load(); }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminCreateInvite({ max_uses: maxUses, expires_in_days: expiresIn ? Number(expiresIn) : null });
      await load();
    } catch (ex: any) {
      setError(ex.message || "Create failed");
    } finally {
      setBusy(false);
    }
  }
  async function onDelete(id: number) {
    if (!confirm("Delete this invite code?")) return;
    try { await adminDeleteInvite(id); setInvites((xs) => xs.filter((i) => i.id !== id)); }
    catch (ex: any) { alert(ex.message || "Delete failed"); }
  }
  function copy(inv: Invite) {
    navigator.clipboard?.writeText(inv.code).then(() => {
      setCopied(inv.id);
      setTimeout(() => setCopied((c) => (c === inv.id ? null : c)), 1500);
    }, () => {});
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      <form onSubmit={onCreate} className="card !p-5 flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Max uses</label>
          <input className="input !w-28" type="number" min={1} max={1000} value={maxUses}
            onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value)))} />
        </div>
        <div>
          <label className="label">Expires in (days) <span className="text-white/30">opt.</span></label>
          <input className="input !w-36" type="number" min={1} placeholder="never" value={expiresIn}
            onChange={(e) => setExpiresIn(e.target.value)} />
        </div>
        <button disabled={busy} className="btn-primary" type="submit">
          {busy ? "Generating…" : "Generate code"}
        </button>
      </form>

      <div className="grid gap-3">
        {invites.map((inv) => (
          <div key={inv.id} className="card !p-4 flex items-center gap-4">
            <button
              onClick={() => copy(inv)}
              title="Click to copy"
              className="font-mono text-lg tracking-widest text-brand-light hover:text-white transition shrink-0"
            >
              {inv.code}
            </button>
            {copied === inv.id && <span className="text-xs text-emerald-300">copied</span>}
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
          <div className="card text-center py-12 text-white/50">No invite codes yet. Generate one above.</div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Downloads ------------------------------- */

const ROW_STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
  failed: "bg-red-400/15 text-red-300 border-red-400/30",
  canceled: "bg-white/10 text-white/60 border-white/20",
  running: "bg-brand/15 text-brand-light border-brand/30",
  pending: "bg-amber-400/15 text-amber-300 border-amber-400/30",
};

function DownloadsPanel() {
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(q?: string) {
    setError(null);
    try {
      const res = await adminListJobs({ search: q });
      setJobs(res.items);
      setTotal(res.total);
    } catch (ex: any) {
      setError(ex.message || "Failed to load downloads");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(() => load(search), 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); load(search); }} className="flex items-center gap-3">
        <input
          className="input"
          placeholder="Search by URL, title, username or IP…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-ghost shrink-0" type="submit">Search</button>
      </form>

      <div className="text-xs text-white/40">{total} download{total === 1 ? "" : "s"} total</div>

      <div className="card !p-0 overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_130px_140px_110px_160px] gap-3 px-4 py-3 text-[11px] uppercase tracking-wider text-white/40 border-b border-white/[0.06]">
          <span>Download</span><span>User</span><span>IP address</span><span>Status</span><span>When</span>
        </div>

        {loading && jobs.length === 0 && <div className="px-4 py-12 text-center text-white/50">Loading…</div>}
        {!loading && jobs.length === 0 && <div className="px-4 py-12 text-center text-white/50">No downloads found.</div>}

        <div className="divide-y divide-white/[0.05]">
          {jobs.map((j) => (
            <div key={j.id} className="grid md:grid-cols-[1fr_130px_140px_110px_160px] gap-1.5 md:gap-3 md:items-center px-4 py-3 hover:bg-white/[0.02] transition">
              <div className="min-w-0">
                <a href={j.url} target="_blank" rel="noopener noreferrer"
                  className="text-sm font-medium truncate block hover:text-brand-light transition" title={j.url}>
                  {j.title || j.url}
                </a>
                <div className="text-xs text-white/40 mt-0.5">
                  <span className="uppercase">{j.format}</span>
                  {j.quality && <span> · {j.quality}</span>}
                  <span> · {fmtBytes(j.file_size)}</span>
                  <span> · via {j.source}</span>
                </div>
              </div>
              <div className="text-sm truncate">
                {j.is_public ? <span className="text-white/50">anonymous</span> : <span>{j.username}</span>}
              </div>
              <div className="font-mono text-xs text-white/70 truncate">{j.client_ip || "-"}</div>
              <div>
                <span className={`badge border ${ROW_STATUS_COLORS[j.status] || ROW_STATUS_COLORS.pending}`}>{j.status}</span>
              </div>
              <div className="text-xs text-white/50">{fmtDateTime(j.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Icons ------------------------------- */

const ip = { className: "w-4 h-4", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const UsersIcon = () => (<svg viewBox="0 0 24 24" {...ip}><circle cx="9" cy="8" r="3.5" /><path d="M3 21a6 6 0 0 1 12 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 21a6 6 0 0 0-3-5.2" /></svg>);
const DownloadIcon = () => (<svg viewBox="0 0 24 24" {...ip}><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>);
const PulseIcon = () => (<svg viewBox="0 0 24 24" {...ip}><path d="M3 12h4l2-7 4 14 2-7h6" /></svg>);
const DiskIcon = () => (<svg viewBox="0 0 24 24" {...ip}><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></svg>);
