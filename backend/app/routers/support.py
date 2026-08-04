import httpx
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form

from ..models.user import User
from ..middleware.auth import get_current_user
from ..config import settings

router = APIRouter(tags=["support"])

TELEGRAM_API = "https://api.telegram.org"

REPORT_EMOJIS = {
    "bug": "\U0001f41b",
    "suggestion": "\U0001f4a1",
}

REPORT_LABELS = {
    "bug": "Bug Report",
    "suggestion": "Sugerencia",
}


async def _send_telegram_text(text: str):
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID
    if not token or not chat_id:
        raise HTTPException(
            status_code=500,
            detail="Telegram no configurado en el servidor",
        )
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{TELEGRAM_API}/bot{token}/sendMessage",
            data={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Error al enviar a Telegram",
            )


async def _send_telegram_photo(text: str, photo_bytes: bytes, filename: str):
    token = settings.TELEGRAM_BOT_TOKEN
    chat_id = settings.TELEGRAM_CHAT_ID
    if not token or not chat_id:
        raise HTTPException(
            status_code=500,
            detail="Telegram no configurado en el servidor",
        )
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{TELEGRAM_API}/bot{token}/sendPhoto",
            data={"chat_id": chat_id, "caption": text, "parse_mode": "HTML"},
            files={"photo": (filename, photo_bytes, "image/jpeg")},
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Error al enviar a Telegram",
            )


@router.post("")
async def send_support_report(
    report_type: str = Form(...),
    description: str = Form(...),
    screenshot: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
):
    if report_type not in REPORT_EMOJIS:
        raise HTTPException(400, "Tipo inválido. Usa 'bug' o 'suggestion'")

    desc = description.strip()
    if len(desc) < 10:
        raise HTTPException(400, "La descripción debe tener al menos 10 caracteres")

    now = datetime.utcnow()
    emoji = REPORT_EMOJIS[report_type]
    label = REPORT_LABELS[report_type]
    house = current_user.house or "Sin casa"

    text = (
        f"{emoji} <b>{label}</b> — Hogwarts Nexus\n"
        f"━━━━━━━━━━━━━━━━━━━━━\n"
        f"\U0001f464 <b>Usuario:</b> {current_user.name}\n"
        f"\U0001f3e0 <b>Casa:</b> {house}\n"
        f"\U0001f4c5 <b>Fecha:</b> {now.strftime('%d %b %Y, %H:%M')} UTC\n"
        f"\n<b>Descripción:</b>\n{desc}"
    )

    if screenshot:
        content = await screenshot.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(400, "El screenshot no puede superar 5MB")
        await _send_telegram_photo(text, content, screenshot.filename or "screenshot.jpg")
    else:
        await _send_telegram_text(text)

    return {"ok": True, "message": "Reporte enviado correctamente"}
