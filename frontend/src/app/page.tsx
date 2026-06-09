"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  API_BASE,
  Job,
  Metadata,
  createJob,
  fetchMetadata,
  getJob,
  getToken,
} from "@/lib/api";
import { PlatformMarquee, detectPlatform } from "@/components/platforms";

const MP4_QUALITIES = [
  { v: "best", label: "Best", sub: "Highest available" },
  { v: "1080", label: "1080p", sub: "Full HD" },
  { v: "720", label: "720p", sub: "HD" },
  { v: "480", label: "480p", sub: "SD" },
  { v: "360", label: "360p", sub: "Low" },
];

const MP3_BITRATES = [
  { v: "320", label: "320", sub: "kbps · Best" },
  { v: "256", label: "256", sub: "kbps · High" },
  { v: "192", label: "192", sub: "kbps · Standard" },
  { v: "128", label: "128", sub: "kbps · Low" },
];

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

function fmtDuration(s?: number | null) {
  if (s == null) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  return h
    ? `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
    : `${m}:${String(ss).padStart(2, "0")}`;
}

function fmtETA(s?: number | null) {
  if (s == null) return null;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function fmtSpeed(bps?: number | null) {
  if (!bps) return null;
  if (bps < 1024 * 1024) return `${Math.round(bps / 1024)} KB/s`;
  return `${(bps / (1024 * 1024)).toFixed(2)} MB/s`;
}

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="14" height="12" rx="2" />
    <path d="m22 8-6 4 6 4V8z" />
  </svg>
);
const AudioIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);
const SparkIcon = () => (
  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
    <path d="M12 2l1.8 5.6L19 9.4l-4.6 3.3L16 18l-4-3.3L8 18l1.6-5.3L5 9.4l5.2-1.8L12 2z"/>
  </svg>
);
const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
  </svg>
);

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [format, setFormat] = useState<"mp4" | "mp3">("mp4");
  const [quality, setQuality] = useState<string>("best");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => () => esRef.current?.close(), []);

  async function onFetchMeta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMeta(null);
    setJob(null);
    setLoading(true);
    try {
      const m = await fetchMetadata(url);
      setMeta(m);
    } catch (ex: any) {
      setError(ex.message || "Couldn't fetch metadata");
    } finally {
      setLoading(false);
    }
  }

  async function onStartDownload() {
    if (!meta) return;
    setError(null);
    try {
      const j = await createJob({ url: meta.url, format, quality });
      setJob(j);
      subscribeProgress(j.id);
    } catch (ex: any) {
      setError(ex.message || "Failed to start job");
    }
  }

  function subscribeProgress(jobId: number) {
    esRef.current?.close();
    const token = getToken();
    const poll = async () => {
      try {
        const j = await getJob(jobId);
        setJob(j);
        if (j.status === "completed" || j.status === "failed" || j.status === "canceled") return;
        setTimeout(poll, 1500);
      } catch (ex: any) {
        setError(ex.message || "Lost job connection");
      }
    };
    if (token) {
      try {
        const es = new EventSource(
          `${API_BASE}/api/jobs/${jobId}/events?token=${encodeURIComponent(token)}`
        );
        es.onmessage = (ev) => {
          try {
            const p = JSON.parse(ev.data);
            setJob((prev) =>
              prev
                ? {
                    ...prev,
                    progress: p.progress ?? prev.progress,
                    status: p.status ?? prev.status,
                    eta_seconds: p.eta ?? prev.eta_seconds,
                    speed_bps: p.speed ?? prev.speed_bps,
                  }
                : prev
            );
            if (["completed", "failed", "canceled"].includes(p.status)) {
              es.close();
              getJob(jobId).then(setJob).catch(() => {});
            }
          } catch {}
        };
        es.onerror = () => es.close();
        esRef.current = es;
      } catch {}
    }
    poll();
  }

  const qualities = format === "mp3" ? MP3_BITRATES : MP4_QUALITIES;

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 chip mb-5">
          <SparkIcon /> <span>Self-hosted · No tracking · No ads</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
          Download anything from{" "}
          <span className="bg-gradient-to-r from-brand-light via-brand to-accent bg-clip-text text-transparent">
            1000+ sites
          </span>
          .
        </h1>
        <p className="mt-4 text-white/60 text-base md:text-lg">
          Paste a link from YouTube, TikTok, Instagram, X, Facebook,
          SoundCloud — anything yt-dlp supports. Choose MP4 or MP3, and
          we&apos;ll handle the rest.
        </p>

        <form onSubmit={onFetchMeta} className="mt-7 relative max-w-2xl mx-auto">
          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center text-white/40 pointer-events-none">
              <SearchIcon />
            </div>
            <input
              className="input !pl-10 !pr-36 !py-4 text-base"
              placeholder="https://www.youtube.com/watch?v=…   or any link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
            />
            <div className="absolute inset-y-1.5 right-1.5">
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="btn-primary h-full px-5"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Analyzing
                  </span>
                ) : (
                  <>Fetch <span aria-hidden>→</span></>
                )}
              </button>
            </div>
          </div>
          {error && (
            <div className="mt-3 text-sm text-red-400 text-left flex items-start gap-2 animate-fade-up">
              <span>⚠</span><span>{error}</span>
            </div>
          )}
        </form>
      </section>

      {!meta && !job && (
        <section className="card !p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40 text-center mb-3">
            Works with
          </div>
          <PlatformMarquee />
        </section>
      )}

      {meta && (
        <MetadataCard
          meta={meta}
          format={format}
          setFormat={(f) => { setFormat(f); setQuality(f === "mp3" ? "192" : "best"); }}
          quality={quality}
          setQuality={setQuality}
          qualities={qualities}
          onStart={onStartDownload}
          starting={!!job}
        />
      )}

      {job && <JobProgressCard job={job} />}

      {!meta && !job && <FeatureGrid />}
    </div>
  );
}

function MetadataCard({
  meta, format, setFormat, quality, setQuality, qualities, onStart, starting,
}: {
  meta: Metadata;
  format: "mp4" | "mp3";
  setFormat: (f: "mp4" | "mp3") => void;
  quality: string;
  setQuality: (q: string) => void;
  qualities: { v: string; label: string; sub: string }[];
  onStart: () => void;
  starting: boolean;
}) {
  const platform = detectPlatform(meta.url);
  return (
    <section className="card animate-fade-up">
      <div className="grid md:grid-cols-[280px_1fr] gap-6">
        <div className="relative">
          {meta.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.thumbnail}
              alt=""
              className="w-full aspect-video object-cover rounded-xl border border-white/10"
            />
          ) : (
            <div className="w-full aspect-video rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
              No preview
            </div>
          )}
          <div className="absolute top-2 left-2 chip backdrop-blur bg-black/50">
            <span className="text-white/80">{platform.node}</span>
            <span>{platform.name}</span>
          </div>
          {meta.duration != null && (
            <div className="absolute bottom-2 right-2 chip backdrop-blur bg-black/60 font-mono">
              {fmtDuration(meta.duration)}
            </div>
          )}
        </div>

        <div className="min-w-0 flex flex-col">
          <h2 className="text-xl font-semibold leading-snug">{meta.title || "Untitled"}</h2>
          {meta.uploader && (
            <div className="text-sm text-white/50 mt-1">by {meta.uploader}</div>
          )}

          <div className="mt-5">
            <div className="label">Format</div>
            <div className="grid grid-cols-2 gap-3">
              <FormatCard
                active={format === "mp4"}
                onClick={() => setFormat("mp4")}
                icon={<VideoIcon />}
                title="Video"
                desc="MP4 · audio merged"
              />
              <FormatCard
                active={format === "mp3"}
                onClick={() => setFormat("mp3")}
                icon={<AudioIcon />}
                title="Audio"
                desc="MP3 · extracted"
              />
            </div>
          </div>

          <div className="mt-5">
            <div className="label">{format === "mp3" ? "Bitrate" : "Quality"}</div>
            <div className="flex flex-wrap gap-2">
              {qualities.map((q) => (
                <button
                  key={q.v}
                  onClick={() => setQuality(q.v)}
                  className={`pill ${quality === q.v ? "pill-active" : ""}`}
                >
                  <span className="font-semibold mr-1">{q.label}</span>
                  <span className="text-white/40 text-xs">{q.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button onClick={onStart} disabled={starting} className="btn-primary">
              <DownloadIcon /> Start download
            </button>
            <span className="text-xs text-white/40">
              Saved to your account · history kept
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function FormatCard({
  active, onClick, icon, title, desc,
}: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative text-left rounded-xl border p-4 transition group ${
        active
          ? "border-brand/60 bg-brand/[0.08]"
          : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
      }`}
    >
      <div className={`flex items-center gap-3 ${active ? "text-white" : "text-white/70 group-hover:text-white"}`}>
        <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${active ? "bg-brand/20 text-brand-light" : "bg-white/5 text-white/60"}`}>
          {icon}
        </span>
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-white/50">{desc}</div>
        </div>
      </div>
      {active && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-brand pulse-dot" />
      )}
    </button>
  );
}

function JobProgressCard({ job }: { job: Job }) {
  const pct = Math.min(100, Math.max(0, job.progress || 0));
  const platform = detectPlatform(job.url);
  const isActive = job.status === "pending" || job.status === "running";

  const statusMeta = useMemo(() => {
    switch (job.status) {
      case "completed":
        return { color: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30", label: "Completed" };
      case "failed":
        return { color: "bg-red-400/15 text-red-300 border-red-400/30", label: "Failed" };
      case "canceled":
        return { color: "bg-white/10 text-white/60 border-white/20", label: "Canceled" };
      case "running":
        return { color: "bg-brand/15 text-brand-light border-brand/30", label: "Downloading" };
      default:
        return { color: "bg-amber-400/15 text-amber-300 border-amber-400/30", label: "Queued" };
    }
  }, [job.status]);

  return (
    <section className="card animate-fade-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {job.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={job.thumbnail}
              alt=""
              className="w-20 h-20 rounded-lg object-cover border border-white/10 shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/40 shrink-0">
              {platform.node}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{job.title || job.url}</h3>
            <div className="mt-1 flex items-center gap-2 text-xs text-white/50">
              <span className="chip !py-0.5 !px-2">
                {platform.node}
                <span>{platform.name}</span>
              </span>
              <span>·</span>
              <span className="uppercase">{job.format}</span>
              {job.quality && <><span>·</span><span>{job.quality}</span></>}
            </div>
          </div>
        </div>
        <span className={`badge border ${statusMeta.color}`}>
          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current pulse-dot" />}
          {statusMeta.label}
        </span>
      </div>

      <div className="mt-5">
        <div className="h-2 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className={isActive ? "h-full progress-bar transition-all" : "h-full bg-white/30 transition-all"}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-white/50 mt-2 font-mono">
          <span>{pct.toFixed(1)}%</span>
          <span className="flex items-center gap-3">
            {fmtSpeed(job.speed_bps) && <span>{fmtSpeed(job.speed_bps)}</span>}
            {fmtETA(job.eta_seconds) && <span>ETA {fmtETA(job.eta_seconds)}</span>}
          </span>
        </div>
      </div>

      {job.error && (
        <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-sm text-red-300 break-words">
          {job.error}
        </div>
      )}

      {job.status === "completed" && job.download_url && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <a className="btn-primary" href={job.download_url}>
            <DownloadIcon /> Download file
          </a>
          <span className="text-xs text-white/40">{fmtBytes(job.file_size)}</span>
        </div>
      )}
    </section>
  );
}

function FeatureGrid() {
  const features = [
    {
      title: "Real-time progress",
      desc: "Live percentage, speed and ETA via Server-Sent Events.",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 12h3l3-8 4 16 3-8h5" />
        </svg>
      ),
    },
    {
      title: "Background queue",
      desc: "Multiple downloads run in parallel on a Celery worker pool.",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="6" rx="2" /><rect x="3" y="14" width="18" height="6" rx="2" />
        </svg>
      ),
    },
    {
      title: "Hardened defaults",
      desc: "JWT auth, URL validation, path-traversal guards, token links.",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" />
        </svg>
      ),
    },
    {
      title: "Bot-ready API",
      desc: "Drop-in endpoints for Telegram / Discord / AI tool integrations.",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="7" width="18" height="12" rx="3" /><path d="M12 3v4" />
          <circle cx="9" cy="13" r="1" fill="currentColor" /><circle cx="15" cy="13" r="1" fill="currentColor" />
        </svg>
      ),
    },
    {
      title: "Per-user quotas",
      desc: "Daily limits and concurrent caps built-in. Multi-user ready.",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      ),
    },
    {
      title: "Self-hosted",
      desc: "Your data, your bandwidth. One docker compose up.",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18" />
        </svg>
      ),
    },
  ];
  return (
    <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {features.map((f) => (
        <div key={f.title} className="card !p-5 hover:border-white/20 transition">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand/10 text-brand-light mb-3">
            {f.icon}
          </div>
          <div className="font-semibold">{f.title}</div>
          <div className="text-sm text-white/55 mt-1 leading-relaxed">{f.desc}</div>
        </div>
      ))}
    </section>
  );
}
