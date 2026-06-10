# All-in-one image: builds the static frontend and serves it from the
# FastAPI backend. One container, one port (8000), one /data volume.

# ---- Stage 1: build the frontend to static files (./out) ----
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci || npm install
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend runtime that also serves the frontend ----
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    WEB_DIR=/app/web

WORKDIR /app

# ffmpeg is required for MP3 extraction / muxing.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY backend/ ./
# Static frontend produced by stage 1.
COPY --from=frontend /fe/out ./web

RUN mkdir -p /data/downloads

EXPOSE 8000
VOLUME ["/data"]

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
