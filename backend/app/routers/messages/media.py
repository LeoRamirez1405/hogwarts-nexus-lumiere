"""Media gallery and audio transcription endpoints."""

import os
import tempfile
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ...database import get_db
from ...middleware.auth import get_current_user
from ...models.chat_room import ChatRoomMember
from ...models.message import Message
from ...models.user import User
from ...schemas.message import MessageResponse
from .serializers import serialize_message

router = APIRouter()


@router.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    try:
        import speech_recognition as sr
        from pydub import AudioSegment
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="Audio transcription not available. Install SpeechRecognition and pydub with ffmpeg."
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    tmp_path = None
    wav_path = None
    try:
        suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
        tmp_path = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tmp_path.write(content)
        tmp_path.close()

        wav_path = tmp_path.name + ".wav"
        try:
            audio = AudioSegment.from_file(tmp_path.name)
            audio = audio.set_frame_rate(16000).set_channels(1)
            audio.export(wav_path, format="wav")
        except Exception:
            wav_path = tmp_path.name

        recognizer = sr.Recognizer()
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)

        text = recognizer.recognize_google(audio_data, language="es-ES")
        return {"text": text}

    except sr.UnknownValueError:
        raise HTTPException(status_code=422, detail="No se pudo reconocer el audio")
    except sr.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Servicio de reconocimiento no disponible: {e}")
    finally:
        if tmp_path and os.path.exists(tmp_path.name):
            os.unlink(tmp_path.name)
        if wav_path and os.path.exists(wav_path) and (not tmp_path or wav_path != tmp_path.name):
            os.unlink(wav_path)


@router.get("/rooms/{room_id}/media", response_model=List[MessageResponse])
async def get_room_media(
    room_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=500),
):
    """Get media (images, videos, documents) from a room."""
    member = (
        await db.execute(
            select(ChatRoomMember).where(
                and_(ChatRoomMember.room_id == room_id, ChatRoomMember.user_id == current_user.id)
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this room")

    stmt = (
        select(Message)
        .where(
            and_(
                Message.room_id == room_id,
                or_(
                    Message.attachment_url != None,  # noqa: E711
                    Message.kind.in_(["image", "video", "document", "audio"]),
                ),
            )
        )
        .options(
            selectinload(Message.sender),
            selectinload(Message.reactions),
            selectinload(Message.reply_to).selectinload(Message.sender),
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [await serialize_message(db, m, current_user.id, expand_sender=True, expand_reactions=True) for m in rows]


@router.get("/dm/{user_id}/media", response_model=List[MessageResponse])
async def get_dm_media(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=500),
):
    """Get media from a direct message conversation."""
    convo_filter = or_(
        and_(Message.sender_id == current_user.id, Message.receiver_id == user_id),
        and_(Message.sender_id == user_id, Message.receiver_id == current_user.id),
    )

    stmt = (
        select(Message)
        .where(
            and_(
                convo_filter,
                or_(
                    Message.attachment_url != None,  # noqa: E711
                    Message.kind.in_(["image", "video", "document", "audio"]),
                ),
            )
        )
        .options(
            selectinload(Message.sender),
            selectinload(Message.receiver),
            selectinload(Message.reactions),
            selectinload(Message.reply_to).selectinload(Message.sender),
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).scalars().all()
    return [await serialize_message(db, m, current_user.id, expand_sender=True, expand_receiver=True, expand_reactions=True) for m in rows]
