# Bot integration

The backend exposes a dedicated, modular **bot API** under `/api/bot/*`.
Any client (Telegram bot, Discord bot, a Python script driven by an LLM
tool layer, etc.) can act on behalf of a user by sending two headers:

| Header           | Value                                         |
| ---------------- | --------------------------------------------- |
| `X-Bot-API-Key`  | `BOT_API_KEY` from your `.env`                |
| `X-Bot-User`     | _optional_ username to act as (default admin) |

The bot is intentionally **not bundled** into the backend container —
keep it as a separate service so you can swap implementations.

## Endpoints

- `POST /api/bot/metadata` — inspect a URL, returns title/duration/formats
- `POST /api/bot/jobs` — queue a download (`{url, format: mp4|mp3, quality?}`)
- `GET  /api/bot/jobs/{id}` — poll status; when `status=completed`, the
  response includes `download_url` (a token-protected, time-limited link)

## Example: minimal Telegram bot (pseudo-code)

```python
import httpx, os, asyncio

API = os.environ["API_BASE"]              # http://backend:8000
KEY = os.environ["BOT_API_KEY"]
HEADERS = {"X-Bot-API-Key": KEY}

async def handle_url(chat_id: int, url: str, fmt: str = "mp3"):
    async with httpx.AsyncClient(headers=HEADERS, timeout=60) as c:
        job = (await c.post(f"{API}/api/bot/jobs",
                            json={"url": url, "format": fmt})).json()
        # poll
        while True:
            await asyncio.sleep(2)
            j = (await c.get(f"{API}/api/bot/jobs/{job['id']}")).json()
            if j["status"] in {"completed", "failed", "canceled"}:
                return j
```

When complete, `j["download_url"]` is a fully qualified URL (uses
`PUBLIC_BASE_URL`) that you can send straight to the user.
