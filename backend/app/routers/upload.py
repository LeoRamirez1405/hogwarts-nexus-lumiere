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

MAX_SIZE = 10 * 1024 * 1024  # 10MB (tras compresion)

# Limite duro del archivo crudo: por encima de esto se rechaza sin intentar
# abrirlo (evita decompression bombs y picos de memoria en Pillow).
MAX_RAW_SIZE = 40 * 1024 * 1024  # 40MB

# Umbral: solo se re-encodean imagenes por encima de 1MB.
COMPRESS_THRESHOLD = 1 * 1024 * 1024

MAX_DIMENSION = 1600  # lado mas largo tras redimensionar
JPEG_QUALITY = 82

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def _compress_image(content: bytes, content_type: str) -> tuple[bytes, str]:
    """Redimensiona y re-encodea una imagen para reducir su peso.

    Devuelve (contenido, extension). Las imagenes con transparencia se
    conservan como PNG optimizado; el resto pasa a JPEG. Nuncia amplia y,
    si Pillow no puede procesar el archivo, devuelve el original.
    """
    from PIL import Image
    import io

    if not content_type or content_type == "image/gif":
        return content, ""

    try:
        img = Image.open(io.BytesIO(content))
        img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)
        buf = io.BytesIO()
        if img.mode in ("RGBA", "LA") or (
            img.mode == "P" and "transparency" in img.info
        ):
            img.save(buf, "PNG", optimize=True)
            return buf.getvalue(), ".png"
        img.convert("RGB").save(
            buf, "JPEG", quality=JPEG_QUALITY, optimize=True, progressive=True
        )
        return buf.getvalue(), ".jpg"
    except Exception:
        return content, ""


def _try_cloudinary() -> bool:
    # Support both the combined CLOUDINARY_URL and the three separate vars.
    return bool(os.getenv("CLOUDINARY_URL") or os.getenv("CLOUDINARY_API_KEY"))


def _upload_cloudinary(content: bytes, filename: str) -> str:
    import cloudinary
    import cloudinary.uploader

    if os.getenv("CLOUDINARY_API_KEY"):
        # Explicit credentials take precedence.
        cloudinary.config(
            cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
            api_key=os.getenv("CLOUDINARY_API_KEY"),
            api_secret=os.getenv("CLOUDINARY_API_SECRET"),
            secure=True,
        )
    else:
        # Fall back to the combined CLOUDINARY_URL, which the SDK reads from
        # the environment automatically.
        cloudinary.config(secure=True)
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
    # Devolver una URL RELATIVA y portable ("/uploads/<archivo>") en vez de una
    # absoluta con "localhost". Una URL absoluta a localhost rompe fuera del PC
    # (en el movil "localhost" es el propio movil) y provoca contenido mixto
    # http-en-https. El frontend la sirve same-origin via el proxy (ver mediaSrc
    # en lib/media.ts y el rewrite /api en next.config.ts). PUBLIC_BASE_URL sigue
    # disponible por si un despliegue necesita forzar un host absoluto.
    base = os.getenv("PUBLIC_BASE_URL", "").rstrip("/")
    return f"{base}/uploads/{filename}"


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Tipo de archivo no permitido")

    content = await file.read()
    if len(content) > MAX_RAW_SIZE:
        raise HTTPException(400, "Archivo demasiado grande (max 40MB)")

    ext = ""
    if file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if not ext:
            ext = mimetypes.guess_extension(file.content_type) or ""

    # Comprimir antes del chequeo de tamano: asi los originales grandes
    # (fotos de catalogo, pantallas de alta resolucion) entran como JPEG/PNG
    # livianos y no fallan por el limite de 10MB.
    if len(content) > COMPRESS_THRESHOLD:
        content, compressed_ext = _compress_image(content, file.content_type)
        if compressed_ext:
            ext = compressed_ext

    if len(content) > MAX_SIZE:
        raise HTTPException(400, "Archivo demasiado grande (max 10MB)")

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
