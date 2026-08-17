import json
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import settings

router = APIRouter(tags=["version"])

# Version info file - updated by CI/CD webhook or deployment script.
# Configurable via VERSION_FILE_PATH (útil en prod con filesystem efímero).
VERSION_FILE = Path(settings.VERSION_FILE_PATH) if settings.VERSION_FILE_PATH else (
    Path(__file__).parent.parent.parent / "version_info.json"
)


def load_version_info() -> dict:
    """Load version info from JSON file. Falls back to defaults if missing."""
    defaults = {
        "current": "0.1.0",
        "latest": "0.1.0",
        "version_code": 1,
        "apk_download_url": "/api/app/apk",
        "release_notes": "",
        "force_update": False,
        "min_supported_version": "0.1.0",
    }
    if VERSION_FILE.exists():
        try:
            with open(VERSION_FILE) as f:
                data = json.load(f)
                return {**defaults, **data}
        except Exception:
            pass
    return defaults


def save_version_info(data: dict) -> None:
    """Save version info to JSON file."""
    VERSION_FILE.parent.mkdir(exist_ok=True)
    with open(VERSION_FILE, "w") as f:
        json.dump(data, f, indent=2)


@router.get("/app/version", tags=["version"])
def app_version():
    """
    Returns current app version info for auto-update checks.
    
    Response:
    {
        "current": "1.0.0",          # Version the client is running (from NEXT_PUBLIC_APP_VERSION)
        "latest": "1.0.1",           # Latest available version
        "version_code": 10001,       # Android versionCode (major*10000 + minor*100 + patch)
        "apk_download_url": "/api/app/apk",  # Direct APK download endpoint
        "release_notes": "Bug fixes and improvements",
        "force_update": false,       # If true, block app usage until updated
        "min_supported_version": "0.1.0",  # Minimum version that can connect
        "available_update": true     # latest != current
    }
    """
    info = load_version_info()
    current = info["current"]
    latest = info["latest"]
    return {
        "current": current,
        "latest": latest,
        "version_code": info.get("version_code", 1),
        "apk_download_url": info.get("apk_download_url", "/api/app/apk"),
        "release_notes": info.get("release_notes", ""),
        "force_update": info.get("force_update", False),
        "min_supported_version": info.get("min_supported_version", "0.1.0"),
        "available_update": latest != current,
    }


class VersionUpdate(BaseModel):
    version: str
    version_code: int | None = None
    release_notes: str = ""
    force_update: bool = False
    min_supported_version: str | None = None


@router.post("/app/version", tags=["version"])
def update_version_info(payload: VersionUpdate):
    """
    Update version info - called by CI/CD webhook after successful APK build.
    Secured by deployment secret in production.
    """
    info = load_version_info()
    info["latest"] = payload.version
    if payload.version_code:
        info["version_code"] = payload.version_code
    if payload.release_notes:
        info["release_notes"] = payload.release_notes
    if payload.force_update:
        info["force_update"] = payload.force_update
    if payload.min_supported_version:
        info["min_supported_version"] = payload.min_supported_version
    save_version_info(info)
    return {"status": "ok", "version": info}