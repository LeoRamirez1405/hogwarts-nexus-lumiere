from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse, RedirectResponse
from pathlib import Path

from .auth import get_current_user
from ..config import settings
from ..models import User

router = APIRouter(tags=["apk"])

# Ruta al APK firmado en filesystem local (dev). Configurable via APK_FILE_PATH.
APK_PATH = Path(settings.APK_FILE_PATH)

# Ruta del APK commiteado por el CI en el repo (backend/static/Nexus.apk).
# En prod (Render, filesystem efímero) el checkout lo trae, así el backend lo
# sirve directo sin depender de GitHub Releases.
CHECKOUT_APK_PATH = Path(__file__).parent.parent.parent / "static" / "Nexus.apk"

# URL del último APK en GitHub Releases. Fallback si no hay archivo local.
GITHUB_APK_URL = (
    f"https://github.com/{settings.GITHUB_REPO}/releases/latest/download/"
    "app-release.apk"
)


def _resolve_apk() -> Path | None:
    """Primer candidato existente: APK_FILE_PATH (dev) → backend/static (prod)."""
    if APK_PATH.exists() and APK_PATH.stat().st_size > 0:
        return APK_PATH
    if CHECKOUT_APK_PATH.exists() and CHECKOUT_APK_PATH.stat().st_size > 0:
        return CHECKOUT_APK_PATH
    return None


def _serve_apk(apk: Path) -> FileResponse:
    return FileResponse(
        path=str(apk),
        filename="Nexus.apk",
        media_type="application/vnd.android.package-archive",
        headers={
            "Content-Disposition": 'attachment; filename="Nexus.apk"',
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/app/apk", tags=["apk"])
async def download_apk(current_user: User = Depends(get_current_user)):
    """
    Descarga el APK firmado para instalación directa (sideload) en Android.
    Requiere autenticación (usuario logueado).

    En dev sirve el archivo local; en prod sirve el APK del checkout del repo;
    si no hay archivo, redirige al GitHub Release.
    """
    apk = _resolve_apk()
    if apk is not None:
        return _serve_apk(apk)
    return RedirectResponse(url=GITHUB_APK_URL, status_code=307)


@router.get("/app/apk/info", tags=["apk"])
async def apk_info(current_user: User = Depends(get_current_user)):
    """
    Información sobre el APK disponible (versión, tamaño, fecha).
    """
    apk = _resolve_apk()
    if apk is not None:
        stat = apk.stat()
        return {
            "available": True,
            "filename": "Nexus.apk",
            "size_bytes": stat.st_size,
            "size_mb": round(stat.st_size / (1024 * 1024), 2),
            "modified": stat.st_mtime,
            "download_url": "/api/app/apk",
        }
    # Sin archivo local: el APK vive en GitHub Releases.
    return {
        "available": True,
        "filename": "app-release.apk",
        "download_url": GITHUB_APK_URL,
        "source": "github-releases",
    }