# yt-download

A self-hosted, modern web UI + API for [`yt-dlp`](https://github.com/yt-dlp/yt-dlp).
Designed to start as a personal tool and grow into a public multi-user
service: built-in user accounts, quotas, JWT auth, rate limiting,
SSRF/path-traversal protections, token-protected download links, and a
dedicated bot/AI integration interface.

| Layer        | Tech                                  |
| ------------ | ------------------------------------- |
| Frontend     | Next.js 14 (App Router) + TailwindCSS |
| Backend      | FastAPI (Python 3.12)                 |
| Worker       | Celery + Redis                        |
| Engine       | yt-dlp + FFmpeg                       |
| Database     | PostgreSQL 16                         |
| Deployment   | Docker Compose                        |

---

## Features

- **Web UI** — paste URL, fetch metadata (title, thumbnail, duration,
  formats), pick MP4 or MP3 + quality, start download, live progress,
  download finished file, browse history.
- **REST API** — full Swagger UI at `/docs`, ReDoc at `/redoc`.
- **Async jobs** — Celery worker pool, multiple concurrent downloads,
  per-user concurrency caps.
- **Real-time progress** — Redis pub/sub streamed via SSE, with DB
  polling fallback.
- **Auth** — JWT (OAuth2 Password flow), bootstrap admin from env, DB
  ready for multi-user (per-user quotas, daily limits, concurrency).
- **Security**
  - URL validation (http(s) only, length cap, allow/block lists,
    private/loopback IP rejection — basic SSRF defense).
  - `MAX_FILE_SIZE_MB` enforced inside yt-dlp.
  - `JOB_TIMEOUT_SECONDS` Celery soft/hard limits.
  - Path-traversal guards on filesystem ops.
  - Per-job random tokens for download links + TTL.
  - Per-user rate limits on metadata and job creation.
- **Bot/AI interface** — separate `/api/bot/*` endpoints authenticated
  with a static API key + optional acting-user header. Modular, not
  baked into the core; see [bot/README.md](bot/README.md).

---

## Quick start (Docker)

```bash
cp .env.example .env          # edit SECRET_KEY, ADMIN_PASSWORD, BOT_API_KEY
docker compose up --build
```

Then open:

- Web UI:    <http://localhost:3000>
- API docs:  <http://localhost:8000/docs>
- Health:    <http://localhost:8000/health>

The first boot:

1. Postgres starts and is migrated by Alembic (`alembic upgrade head`).
2. Backend creates the bootstrap admin user (`ADMIN_USERNAME` /
   `ADMIN_PASSWORD`).
3. Worker connects to Redis and starts consuming the `downloads` queue.

Downloaded files land under `./storage/user_<id>/` on the host
(mounted to `/data/downloads` inside containers).

---

## Local dev (without Docker)

You still need Postgres + Redis + ffmpeg running locally.

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export $(grep -v '^#' ../.env | xargs)   # or use direnv
alembic upgrade head
uvicorn app.main:app --reload
# in a 2nd shell:
celery -A app.workers.celery_app.celery worker --loglevel=INFO

# frontend
cd frontend
npm install
npm run dev
```

---

## Configuration

All configuration lives in `.env` (see `.env.example` for the full list).
Highlights:

| Var                       | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `SECRET_KEY`              | JWT signing key — **change in production**           |
| `ADMIN_USERNAME/PASSWORD` | Bootstrap admin created on first boot                |
| `BOT_API_KEY`             | Static key for the bot/AI endpoints                  |
| `PUBLIC_BASE_URL`         | Base URL used to build returned download links       |
| `DOWNLOAD_DIR`            | Where files are stored (`/data/downloads`)           |
| `MAX_FILE_SIZE_MB`        | Per-download cap enforced by yt-dlp                  |
| `JOB_TIMEOUT_SECONDS`     | Celery soft/hard time limit                          |
| `DEFAULT_DAILY_JOB_QUOTA` | Default per-user daily job count                     |
| `DEFAULT_CONCURRENT_JOBS` | Default per-user concurrent running jobs             |
| `ALLOWED_DOMAINS`         | Comma-separated allow list (empty = allow any)       |
| `BLOCKED_DOMAINS`         | Always blocked (defaults block localhost + metadata) |
| `CORS_ORIGINS`            | Allowed origins for the API                          |

---

## API examples

Get a token:

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -d 'username=admin&password=admin'
# => {"access_token":"...", "token_type":"bearer"}
TOKEN="..."
```

Inspect a URL:

```bash
curl -X POST http://localhost:8000/api/metadata \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

Queue a download:

```bash
curl -X POST http://localhost:8000/api/jobs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","format":"mp3","quality":"192"}'
# => {"id": 1, "status": "pending", ...}
```

Poll a job:

```bash
curl http://localhost:8000/api/jobs/1 -H "Authorization: Bearer $TOKEN"
```

When `status=completed`, the response includes a `download_url` with a
token query parameter; that URL is publicly fetchable (until the token
expires per `DOWNLOAD_TOKEN_TTL_SECONDS`).

Bot flow (no JWT, uses the bot key):

```bash
curl -X POST http://localhost:8000/api/bot/jobs \
  -H "X-Bot-API-Key: $BOT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://youtu.be/...","format":"mp4","quality":"720"}'
```

See [bot/README.md](bot/README.md) for a Telegram bot sketch.

---

## Project structure

```
yt-download/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/                  # migrations
│   └── app/
│       ├── main.py               # FastAPI entry + admin bootstrap
│       ├── config.py             # pydantic-settings
│       ├── database.py
│       ├── api/                  # auth, metadata, jobs, files, bot
│       ├── core/                 # security, url validator, rate limit
│       ├── models/               # User, DownloadJob
│       ├── schemas/              # pydantic IO models
│       ├── services/             # yt-dlp wrapper, storage
│       └── workers/              # Celery app + tasks
├── frontend/                     # Next.js 14 + Tailwind
└── bot/README.md                 # bot integration guide
```

---

## Roadmap / multi-user notes

The data model already supports multi-user:

- `User.is_admin`, `daily_job_quota`, `concurrent_jobs` (nullable
  overrides over global defaults).
- `DownloadJob.user_id` + `source` (`web|bot|api`).
- Per-user storage subdirectory.
- Per-user Redis quota counters (`quota:daily:<uid>:<day>`).

To open registration: add a `POST /api/auth/register` endpoint guarded
by a setting like `REGISTRATION_OPEN=true`, and restrict admin-only
operations behind the existing `get_current_admin` dependency.

---

## License

MIT (do whatever — yt-dlp's terms still apply to scraped content).
