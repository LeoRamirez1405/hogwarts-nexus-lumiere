from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path

from .auth import get_current_user
from ..config import settings
from ..models import User

router = APIRouter(tags=["apk"])

# Ruta al APK firmado en filesystem local (dev). Configurable via APK_FILE_PATH.
APK_PATH = Path(settings.APK_FILE_PATH)

# URL del último APK en GitHub Releases. El CI (build-android-apk.yml) sube el
# APK a cada Release, así que en prod no hay que almacenar el archivo en el
# servidor: solo redirigimos al asset del último release.
GITHUB_APK_URL = (
    f"https://github.com/{settings.GITHUB_REPO}/releases/latest/download/"
    "app-release.apk"
)


def _serve_local_apk() -> FileResponse:
    if not APK_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="APK no disponible. Ejecuta 'npx capacitor build android' en el frontend para generarlo.",
        )
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
        },
    )


@router.get("/app/apk", tags=["apk"])
async def download_apk(current_user: User = Depends(get_current_user)):
    """
    Descarga el APK firmado para instalación directa (sideload) en Android.
    Requiere autenticación (usuario logueado).

    En dev sirve el archivo local; en prod redirige al GitHub Release.
    """
    # En desarrollo (filesystem local presente) servimos el archivo directo.
    if APK_PATH.exists():
        return _serve_local_apk()
    # En producción no hay APK en el servidor: redirigimos al Release de GitHub.
    return RedirectResponse(url=GITHUB_APK_URL, status_code=307)


@router.get("/app/apk/info", tags=["apk"])
async def apk_info(current_user: User = Depends(get_current_user)):
    """
    Información sobre el APK disponible (versión, tamaño, fecha).
    """
    if APK_PATH.exists():
        stat = APK_PATH.stat()
        return {
            "available": True,
            "filename": "hogwarts-nexus.apk",
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "modified": stat.st_mtime,
            "download_url": "/api/app/apk",
        }
    # En prod sin archivo local: el APK vive en GitHub Releases.
    return {
        "available": True,
        "filename": "app-release.apk",
        "download_url": GITHUB_APK_URL,
        "source": "github-releases",
    }