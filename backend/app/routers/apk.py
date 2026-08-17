from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

from .auth import get_current_user
from ..config import settings
from ..models import User

router = APIRouter(tags=["apk"])

# Ruta al APK firmado. Configurable via APK_FILE_PATH (ver app/config.py).
APK_PATH = Path(settings.APK_FILE_PATH)


@router.get("/app/apk", tags=["apk"])
async def download_apk(current_user: User = Depends(get_current_user)):
    """
    Descarga el APK firmado para instalación directa (sideload) en Android.
    Requiere autenticación (usuario logueado).
    """
    if not APK_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="APK no disponible. Ejecuta 'npx capacitor build android' en el frontend para generarlo."
        )
    
    # Verificar que el archivo es un APK válido (tamaño > 0)
    if APK_PATH.stat().st_size == 0:
        raise HTTPException(status_code=500, detail="APK corrupto (archivo vacío)")
    
    return FileResponse(
        path=str(APK_PATH),
        filename="hogwarts-nexus.apk",
        media_type="application/vnd.android.package-archive",
        headers={
            "Content-Disposition": 'attachment; filename="hogwarts-nexus.apk"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        }
    )


@router.get("/app/apk/info", tags=["apk"])
async def apk_info(current_user: User = Depends(get_current_user)):
    """
    Información sobre el APK disponible (versión, tamaño, fecha).
    """
    if not APK_PATH.exists():
        return {"available": False, "message": "APK no generado"}
    
    stat = APK_PATH.stat()
    return {
        "available": True,
        "filename": "hogwarts-nexus.apk",
        "size_bytes": stat.st_size,
        "size_mb": round(stat.st_size / (1024 * 1024), 2),
        "modified": stat.st_mtime,
        "download_url": "/api/app/apk",
    }