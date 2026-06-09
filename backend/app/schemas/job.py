from datetime import datetime
from typing import List, Literal, Optional

from pydantic import AnyHttpUrl, BaseModel, Field


# ----- Metadata -----

class FormatOption(BaseModel):
    format_id: str
    ext: str
    resolution: Optional[str] = None
    fps: Optional[float] = None
    vcodec: Optional[str] = None
    acodec: Optional[str] = None
    filesize: Optional[int] = None
    tbr: Optional[float] = None
    note: Optional[str] = None


class MetadataResponse(BaseModel):
    url: str
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    duration: Optional[int] = None
    uploader: Optional[str] = None
    formats: List[FormatOption] = []


class MetadataRequest(BaseModel):
    url: AnyHttpUrl


# ----- Jobs -----

class JobCreate(BaseModel):
    url: AnyHttpUrl
    format: Literal["mp4", "mp3"] = "mp4"
    quality: Optional[str] = Field(
        default=None,
        description="For mp4: best|1080|720|480|360. For mp3: 320|256|192|128.",
    )
    format_id: Optional[str] = Field(
        default=None, description="Optional exact yt-dlp format_id for advanced selection."
    )


class JobRead(BaseModel):
    id: int
    user_id: int
    source: str
    url: str
    format: str
    quality: Optional[str]
    status: str
    progress: float
    eta_seconds: Optional[int]
    speed_bps: Optional[int]
    title: Optional[str]
    thumbnail: Optional[str]
    duration_seconds: Optional[int]
    file_size: Optional[int]
    error: Optional[str]
    download_url: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime]
    finished_at: Optional[datetime]

    class Config:
        from_attributes = True


class JobList(BaseModel):
    total: int
    items: List[JobRead]
