export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const TOKEN_KEY = "ytdl_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

type ApiOpts = RequestInit & { auth?: boolean };

export async function api<T>(path: string, opts: ApiOpts = {}): Promise<T> {
  const headers = new Headers(opts.headers || {});
  if (opts.auth !== false) {
    const t = getToken();
    if (t) headers.set("Authorization", `Bearer ${t}`);
  }
  if (opts.body && !(opts.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status === 401 && typeof window !== "undefined") {
    setToken(null);
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }
  if (!res.ok) {
    let detail: any = res.statusText;
    try {
      detail = (await res.json()).detail || detail;
    } catch {}
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---- Typed helpers ----

export type FormatOption = {
  format_id: string;
  ext: string;
  resolution?: string | null;
  vcodec?: string | null;
  acodec?: string | null;
  filesize?: number | null;
  note?: string | null;
};

export type Metadata = {
  url: string;
  title?: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  formats: FormatOption[];
};

export type Job = {
  id: number;
  user_id: number;
  source: string;
  url: string;
  format: "mp4" | "mp3";
  quality?: string | null;
  status: "pending" | "running" | "completed" | "failed" | "canceled";
  progress: number;
  eta_seconds?: number | null;
  speed_bps?: number | null;
  title?: string | null;
  thumbnail?: string | null;
  duration_seconds?: number | null;
  file_size?: number | null;
  error?: string | null;
  download_url?: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
};

export async function login(username: string, password: string) {
  const form = new URLSearchParams();
  form.set("username", username);
  form.set("password", password);
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!res.ok) {
    let detail = "Login failed";
    try {
      detail = (await res.json()).detail || detail;
    } catch {}
    throw new Error(detail);
  }
  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export async function fetchMetadata(url: string) {
  return api<Metadata>("/api/metadata", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function createJob(input: {
  url: string;
  format: "mp4" | "mp3";
  quality?: string;
  format_id?: string;
}) {
  return api<Job>("/api/jobs", { method: "POST", body: JSON.stringify(input) });
}

export async function getJob(id: number) {
  return api<Job>(`/api/jobs/${id}`);
}

export async function listJobs(): Promise<{ total: number; items: Job[] }> {
  return api(`/api/jobs?limit=100`);
}

export async function deleteJob(id: number) {
  return api<void>(`/api/jobs/${id}`, { method: "DELETE" });
}
