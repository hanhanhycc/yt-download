from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.rate_limit import check_rate_limit
from app.core.url_validator import URLValidationError, validate_url
from app.models.user import User
from app.schemas.job import MetadataRequest, MetadataResponse
from app.services.ytdlp_service import extract_metadata

router = APIRouter(prefix="/api/metadata", tags=["metadata"])


@router.post(
    "",
    response_model=MetadataResponse,
    summary="Fetch video metadata (title, thumbnail, formats)",
)
def fetch_metadata(
    payload: MetadataRequest,
    user: Annotated[User, Depends(get_current_user)],
):
    # Cheap rate limit: 20 metadata calls / minute per user
    allowed, _ = check_rate_limit(f"meta:{user.id}", limit=20, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="metadata rate limit exceeded"
        )

    try:
        url = validate_url(str(payload.url))
    except URLValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        data = extract_metadata(url)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"yt-dlp error: {exc}") from exc
    return MetadataResponse(**data)
