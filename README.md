# yt-download

A self-hosted, modern web UI + API for [`yt-dlp`](https://github.com/yt-dlp/yt-dlp),
packaged as **a single Docker container** so it runs anywhere — a Synology
NAS, a VPS, or your laptop — with one image and one volume.

| Layer    | Tech                                            |
| -------- | ----------------------------------------------- |
| Frontend | Next.js 14 (static export, served by the API)   |
| Backend  | FastAPI (Python 3.12)                           |
| Worker   | In-process thread pool (no Celery/Redis)        |
| Engine   | yt-dlp + FFmpeg                                  |
| Database | SQLite (file in the data volume)                |
| Packaging| One Docker image                                |

Everything (web UI, REST API, download workers, database) runs in **one
container**. State lives in a single `/data` volume:
`/data/app.db` (SQLite) and `/data/downloads/` (files).

---

## Features

- **Web UI** — paste a URL, fetch metadata, pick MP4/MP3 + quality, watch
  live progress, download the file, browse history.
- **REST API** — Swagger UI at `/docs`.
- **Auth** — JWT login, bootstrap admin from env.
- **Real-time progress** — Server-Sent Events with DB polling.
- **Bot/AI interface** — `/api/bot/*` endpoints with a static API key.
- **yt-dlp cookies** support to get past YouTube's bot check.

---

## Deploy on Synology NAS (Container Manager)

The image is built automatically by GitHub Actions and published to
**GitHub Container Registry** at `ghcr.io/hanhanhycc/yt-download:latest`.

> First, on GitHub: open the repo → **Packages** → the `yt-download`
> package → **Package settings** → set visibility to **Public** (so the NAS
> can pull without logging in). Or `docker login ghcr.io` on the NAS with a
> Personal Access Token that has `read:packages`.

### Steps

1. DSM → **Container Manager** → **Project** → **Create**.
2. Path: a folder on the NAS (e.g. `/volume1/docker/yt-download`).
3. Source: **Create docker-compose.yml** and paste:

   ```yaml
   services:
     app:
       image: ghcr.io/hanhanhycc/yt-download:latest
       restart: unless-stopped
       ports:
         - "8000:8000"
       environment:
         SECRET_KEY: "<a-long-random-string>"
         ADMIN_USERNAME: "admin"
         ADMIN_PASSWORD: "<your-password>"
         PUBLIC_BASE_URL: "http://<nas-ip>:8000"
         DOWNLOAD_CONCURRENCY: "2"
         # Optional, to download from YouTube (see Cookies below):
         YTDLP_COOKIES_B64: ""
       volumes:
         - ./data:/data
   ```

4. Build/run the project.
5. Open `http://<nas-ip>:8000` and log in with `ADMIN_USERNAME` /
   `ADMIN_PASSWORD`.

> Lost the admin password? Set `ADMIN_RESET_ON_BOOT: "true"` and
> `ADMIN_PASSWORD` to a new value, restart the project, log in, then set
> `ADMIN_RESET_ON_BOOT` back to `"false"`.

---

## Run anywhere with Docker

```bash
cp .env.example .env        # edit SECRET_KEY, ADMIN_PASSWORD, ...
docker compose up -d
# UI + API:  http://localhost:8000
```

Or a plain `docker run`:

```bash
docker run -d --name yt-download -p 8000:8000 \
  -e SECRET_KEY="a-long-random-string" \
  -e ADMIN_PASSWORD="your-password" \
  -e PUBLIC_BASE_URL="http://localhost:8000" \
  -v "$PWD/data:/data" \
  ghcr.io/hanhanhycc/yt-download:latest
```

To build the image yourself instead of pulling: `docker build -t yt-download .`
(or uncomment `build: .` in `docker-compose.yml`).

---

## YouTube cookies (bypass "Sign in to confirm you're not a bot")

On server/NAS IPs YouTube often blocks anonymous requests. Provide cookies
from a **throwaway** logged-in account:

1. In an **incognito** window, log into YouTube, export `cookies.txt` with
   the *"Get cookies.txt LOCALLY"* browser extension, then close the window.
2. Base64-encode it:
   - Windows: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cookies.txt"))`
   - Linux/macOS: `base64 -w0 cookies.txt`
3. Set `YTDLP_COOKIES_B64` to that string and restart.

Cookies expire — refresh them when the bot check returns.

---

## Configuration

| Var                     | Purpose                                          |
| ----------------------- | ------------------------------------------------ |
| `SECRET_KEY`            | JWT signing key — change in production           |
| `ADMIN_USERNAME/PASSWORD` | Admin login, created on first start            |
| `ADMIN_RESET_ON_BOOT`   | Reset admin password from env on boot            |
| `PUBLIC_BASE_URL`       | Base URL for returned download links             |
| `DOWNLOAD_CONCURRENCY`  | Parallel downloads (thread pool size)            |
| `MAX_FILE_SIZE_MB`      | Per-download cap enforced by yt-dlp              |
| `YTDLP_COOKIES_B64`     | base64 cookies.txt for YouTube                   |
| `BOT_API_KEY`           | Static key for `/api/bot/*`                      |

---

## License

MIT (yt-dlp's terms still apply to scraped content).
