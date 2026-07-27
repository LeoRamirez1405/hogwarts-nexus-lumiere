from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
import cloudinary
import cloudinary.uploader
import cloudinary.api
from ..middleware.auth import get_current_user
import uuid
import mimetypes
import os
import asyncio
from typing import Optional

router = APIRouter(tags=["upload"])

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

# Allowed file types
ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/webm", "video/quicktime",
    "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}

# Max file size (10MB)
MAX_SIZE = 10 * 1024 * 1024

@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    current_user = Depends(get_current_user)
):
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Tipo de archivo no permitido")
    
    # Read file content
    content = await file.read()
    
    # Validate file size
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "Archivo demasiado grande (max 10MB)")
    
    # Determine file extension
    ext = ""
    if file.filename:
        ext = os.path.splitext(file.filename)[1].lower()
        if not ext:
            # Guess extension from content type
            ext = mimetypes.guess_extension(file.content_type) or ""
    
    # Generate unique filename
    filename = f"{uuid.uuid4()}{ext}"
    
    try:
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            content,
            public_id=f"nexus_uploads/{filename}",
            resource_type="auto"  # Automatically detect file type
        )
        
        # Return secure URL
        file_url = result.get("secure_url")
        if not file_url:
            raise HTTPException(500, "Error al subir archivo a Cloudinary")
        
        return {
            "url": file_url,
            "type": file.content_type.split("/")[0],
            "original_name": file.filename
        }
    except Exception as e:
        raise HTTPException(500, f"Error al subir archivo: {str(e)}")


@router.get("/{filename}")
async def serve_upload(filename: str):
    # This endpoint is kept for compatibility but will return 404
    # since files are now stored in Cloudinary
    raise HTTPException(404, "Archivo no encontrado. Los archivos ahora se almacenan en Cloudinary.")

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


@router.post("")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Tipo de archivo no permitido")
    
    # Read file content
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(400, "Archivo demasiado grande (max 10MB)")
    
    # Generate unique filename
    file_extension = ""
    if file.filename:
        file_extension = os.path.splitext(file.filename)[1]
    if not file_extension:
        # Guess extension from content type
        extension = mimetypes.guess_extension(file.content_type)
        file_extension = extension if extension else ""
    
    # Create unique public_id for Cloudinary
    public_id = f"hogwarts_nexus/{uuid.uuid4()}{file_extension}"
    
    # Upload to Cloudinary
    try:
        upload_result = cloudinary.uploader.upload(
            content,
            public_id=public_id,
            resource_type="auto"  # Automatically detect file type
        )
        
        # Return the secure URL
        file_url = upload_result.get("secure_url")
        
        return {
            "url": file_url,
            "type": file.content_type.split("/")[0],
            "original_name": file.filename
        }
    except Exception as e:
        raise HTTPException(500, f"Error al subir archivo: {str(e)}")


@router.get("/{filename}")
async def serve_upload(filename: str):
    # This endpoint is kept for backward compatibility but will return 404
    # since files are now stored in Cloudinary
    raise HTTPException(status_code=404, detail="Archivo no encontrado (usar Cloudinary)")