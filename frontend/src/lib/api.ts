// Same-origin by default: the backend serves this static frontend, so API
// calls go to /api/* relatively. Override only for split-origin dev.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

const TOKEN_KEY = "ytdl_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
  // localStorage's native "storage" event only fires in *other* tabs, so emit
  // our own so same-tab listeners (the header nav) update instantly — no F5.
  window.dispatchEvent(new Event("auth-changed"));
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
    let detail = "";
    try {
      const data = await res.json();
      detail =
        typeof data?.detail === "string"
          ? data.detail
          : data?.detail
          ? JSON.stringify(data.detail)
          : "";
    } catch {
      // Non-JSON body (e.g. an HTML 502 from the proxy when the backend is down).
    }
    // statusText is empty over HTTP/2 (Coolify/Traefik TLS), so fall back to the status code.
    throw new Error(detail || res.statusText || `Request failed (HTTP ${res.status})`);
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

export type AppConfig = {
  auth_required: boolean;
  registration_enabled: boolean;
  registration_require_invite: boolean;
  public_history_retention_hours: number;
  member_history_retention_days: number;
  member_download_ttl_days: number;
};

export type Me = {
  id: number;
  username: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
};

export type AdminUser = {
  id: number;
  username: string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  job_count: number;
  last_download_at?: string | null;
};

export type AdminStats = {
  total_members: number;
  total_admins: number;
  total_invites_active: number;
  downloads_total: number;
  downloads_today: number;
  downloads_active: number;
  downloads_failed: number;
  storage_bytes: number;
  status_breakdown: Record<string, number>;
};

export type Invite = {
  id: number;
  code: string;
  max_uses: number;
  used_count: number;
  expires_at?: string | null;
  created_at: string;
  is_exhausted: boolean;
};

export async function getConfig() {
  return api<AppConfig>("/api/config", { auth: false });
}

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
    let detail = "";
    try {
      detail = (await res.json()).detail || "";
    } catch {}
    throw new Error(detail || `Login failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  setToken(data.access_token);
  return data;
}

export async function register(input: {
  username: string;
  password: string;
  email?: string;
  invite_code?: string;
}) {
  const data = await api<{ access_token: string }>("/api/auth/register", {
    method: "POST",
    auth: false,
    body: JSON.stringify(input),
  });
  setToken(data.access_token);
  return data;
}

export async function getMe() {
  return api<Me>("/api/auth/me");
}

export async function updateProfile(input: {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}) {
  return api<Me>("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function changePassword(current_password: string, new_password: string) {
  return api<void>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password }),
  });
}

// ---- Admin ----

export async function adminListUsers() {
  return api<AdminUser[]>("/api/admin/users");
}

export async function adminCreateUser(input: {
  username: string;
  password: string;
  email?: string;
  is_admin?: boolean;
}) {
  return api<AdminUser>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function adminResetPassword(userId: number, new_password: string) {
  return api<void>(`/api/admin/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ new_password }),
  });
}

export async function adminSetActive(userId: number, active: boolean) {
  return api<AdminUser>(`/api/admin/users/${userId}/active?active=${active}`, {
    method: "POST",
  });
}

export async function adminSetRole(userId: number, isAdmin: boolean) {
  return api<AdminUser>(`/api/admin/users/${userId}/role?is_admin=${isAdmin}`, {
    method: "POST",
  });
}

export async function adminDeleteUser(userId: number) {
  return api<void>(`/api/admin/users/${userId}`, { method: "DELETE" });
}

export async function adminStats() {
  return api<AdminStats>("/api/admin/stats");
}

export type AdminJob = {
  id: number;
  username: string;
  is_public: boolean;
  source: string;
  client_ip?: string | null;
  url: string;
  title?: string | null;
  format: string;
  quality?: string | null;
  status: string;
  file_size?: number | null;
  created_at: string;
  finished_at?: string | null;
};

export async function adminListJobs(params?: { search?: string; status?: string }) {
  const qs = new URLSearchParams({ limit: "200" });
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  return api<{ total: number; items: AdminJob[] }>(`/api/admin/jobs?${qs.toString()}`);
}

export async function adminListInvites() {
  return api<Invite[]>("/api/admin/invites");
}

export async function adminCreateInvite(input: {
  max_uses?: number;
  expires_in_days?: number | null;
}) {
  return api<Invite>("/api/admin/invites", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function adminDeleteInvite(id: number) {
  return api<void>(`/api/admin/invites/${id}`, { method: "DELETE" });
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
