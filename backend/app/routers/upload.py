from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from ..middleware.auth import get_current_user
import uuid
import mimetypes
import os
from pathlib import Path

router = APIRouter(tags=["upload"])

ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/webm", "video/quicktime",
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}

MAX_SIZE = 10 * 1024 * 1024  # 10MB

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def _try_cloudinary() -> bool:
    return bool(os.getenv("CLOUDINARY_API_KEY"))


def _upload_cloudinary(content: bytes, filename: str) -> str:
    import cloudinary
    import cloudinary.uploader

    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True,
    )
    result = cloudinary.uploader.upload(
        content,
        public_id=f"nexus_uploads/{filename}",
        resource_type="auto",
    )
    url = result.get("secure_url")
    if not url:
        raise HTTPException(500, "Error al subir archivo a Cloudinary")
    return url


def _upload_local(content: bytes, filename: str) -> str:
    dest = UPLOAD_DIR / filename
    dest.write_bytes(content)
    # Return an absolute URL to the backend so the frontend (served from a
    # different origin/port) can load it. Served as static files under
    # /uploads (see main.py). PUBLIC_BASE_URL lets deployments override the host.
    base = os.getenv("PUBLIC_BASE_URL", "http://localhost:8000").rstrip("/")
    return f"{base}/uploads/{filename}"


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Tipo de archivo no permitido")

    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "Archivo demasiado grande (max 10MB)")

    ext = ""
    if file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if not ext:
            ext = mimetypes.guess_extension(file.content_type) or ""

    filename = f"{uuid.uuid4()}{ext}"

    try:
        if _try_cloudinary():
            file_url = _upload_cloudinary(content, filename)
        else:
            file_url = _upload_local(content, filename)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Error al subir archivo: {str(e)}")

    return {
        "url": file_url,
        "type": file.content_type.split("/")[0],
        "original_name": file.filename,
    }


@router.get("/{filename}")
async def serve_upload(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(404, "Archivo no encontrado")
    import mimetypes as mt
    content_type = mt.guess_type(str(file_path))[0] or "application/octet-stream"
    from fastapi.responses import FileResponse
    return FileResponse(file_path, media_type=content_type)
