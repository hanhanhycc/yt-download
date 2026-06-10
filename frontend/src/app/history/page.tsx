"use client";

import { useEffect, useMemo, useState } from "react";
import { Job, deleteJob, listJobs } from "@/lib/api";
import { detectPlatform } from "@/components/platforms";

function fmtBytes(n?: number | null) {
  if (n == null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function fmtRel(iso: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString();
}

type Filter = "all" | "running" | "completed" | "failed";

export default function HistoryPage() {
  const [items, setItems] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  async function load() {
    setError(null);
    try {
      const res = await listJobs();
      setItems(res.items);
    } catch (ex: any) {
      setError(ex.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  async function onDelete(id: number) {
    if (!confirm("Delete this job?")) return;
    try {
      await deleteJob(id);
      setItems((items) => items.filter((j) => j.id !== id));
    } catch (ex: any) {
      alert(ex.message || "Delete failed");
    }
  }

  const counts = useMemo(() => {
    const c = { all: items.length, running: 0, completed: 0, failed: 0 };
    items.forEach((j) => {
      if (j.status === "running" || j.status === "pending") c.running++;
      else if (j.status === "completed") c.completed++;
      else if (j.status === "failed") c.failed++;
    });
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "running") return items.filter((j) => j.status === "running" || j.status === "pending");
    return items.filter((j) => j.status === filter);
  }, [items, filter]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">History</h1>
          <p className="text-white/50 mt-1 text-sm">
            All your downloads. Updates every 4 seconds.
          </p>
        </div>
        <div className="flex gap-2">
          {(["all", "running", "completed", "failed"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`pill capitalize ${filter === f ? "pill-active" : ""}`}
            >
              {f}
              <span className="ml-1.5 text-xs text-white/40">{counts[f]}</span>
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="card text-center text-white/50 py-12">Loading…</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card text-center py-16">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/5 border border-white/10 mb-4">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white/30" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M3 9h18" />
            </svg>
          </div>
          <div className="font-medium">No jobs yet</div>
          <div className="text-sm text-white/50 mt-1">Paste a URL on the home page to start.</div>
        </div>
      )}

      <div className="grid gap-3">
        {filtered.map((j) => (
          <JobRow key={j.id} job={j} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function JobRow({ job, onDelete }: { job: Job; onDelete: (id: number) => void }) {
  const platform = detectPlatform(job.url);
  const isActive = job.status === "running" || job.status === "pending";
  const statusColor =
    job.status === "completed" ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/30"
    : job.status === "failed" ? "bg-red-400/15 text-red-300 border-red-400/30"
    : job.status === "canceled" ? "bg-white/10 text-white/60 border-white/20"
    : job.status === "running" ? "bg-brand/15 text-brand-light border-brand/30"
    : "bg-amber-400/15 text-amber-300 border-amber-400/30";

  return (
    <div className="card !p-4 flex items-center gap-4 hover:border-white/20 transition">
      <a
        href={job.url}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 group"
        title="Open original on source site"
      >
        {job.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={job.thumbnail}
            alt=""
            className="w-28 h-16 rounded-lg object-cover border border-white/10 transition group-hover:opacity-90"
          />
        ) : (
          <div className="w-28 h-16 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
            {platform.node}
          </div>
        )}
      </a>

      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-light transition underline-offset-4 hover:underline"
            title="Open original on source site"
          >
            {job.title || job.url}
          </a>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50">
          <span className="chip !py-0.5 !px-2">{platform.node}{platform.name}</span>
          <span className="uppercase">{job.format}</span>
          {job.quality && <span>· {job.quality}</span>}
          <span>· {fmtBytes(job.file_size)}</span>
          <span>· {fmtRel(job.created_at)}</span>
        </div>
        {isActive && (
          <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden mt-2">
            <div className="h-full progress-bar" style={{ width: `${job.progress.toFixed(1)}%` }} />
          </div>
        )}
        {job.error && (
          <div className="text-xs text-red-400 mt-1 truncate">{job.error}</div>
        )}
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={`badge border ${statusColor}`}>
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />}
          {job.status}
        </span>
        <div className="flex gap-2">
          {job.status === "completed" && job.download_url && (
            <a className="btn-primary !py-1.5 !px-3 !text-xs" href={job.download_url}>
              Download
            </a>
          )}
          <button
            onClick={() => onDelete(job.id)}
            className="btn-ghost !py-1.5 !px-3 !text-xs"
          >
            {isActive ? "Cancel" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
