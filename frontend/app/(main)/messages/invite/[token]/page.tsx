"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { messagesApi, RoomInviteInfoResponse } from "@/lib/api/messages";
import { MaterialIcon } from "../../helpers";
import Image from "next/image";

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [info, setInfo] = useState<RoomInviteInfoResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    messagesApi.getInviteInfo(token).then(setInfo).catch((e: unknown) => {
      const err = e as { detail?: string; message?: string };
      setError(err?.detail || err?.message || "Enlace inválido");
    });
  }, [token]);

  const handleJoin = async () => {
    setJoining(true);
    setError("");
    try {
      const result = await messagesApi.joinRoomByInvite(token);
      if (result.requires_approval) {
        setError("Su solicitud fue enviada. Un administrador debe aprobarla.");
        setJoined(true);
      } else {
        setJoined(true);
        setTimeout(() => router.push(`/messages?room=${result.room_id}`), 1000);
      }
    } catch (e: unknown) {
      const err = e as { detail?: string; message?: string };
      setError(err?.detail || "Error al unirse");
    } finally {
      setJoining(false);
    }
  };

  if (error && !info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-8">
        <div className="bg-surface-container-highest rounded-2xl p-8 max-w-md w-full text-center shadow-sm border border-outline-variant/20">
          <MaterialIcon name="error_outline" className="text-5xl text-error mb-4" />
          <h2 className="text-headline-md text-on-surface mb-2">Enlace no valido</h2>
          <p className="text-body-md text-on-surface-variant">{error}</p>
          <button
            onClick={() => router.push("/messages")}
            className="mt-6 w-full px-6 py-3 rounded-full bg-primary text-on-primary font-medium"
          >
            Ir a mensajes
          </button>
        </div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <MaterialIcon name="progress_activity" className="text-4xl text-outline-variant animate-spin" />
      </div>
    );
  }

  const canJoin = !info.expired && !info.revoked && !info.uses_exhausted;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-8">
      <div className="bg-surface-container-lowest rounded-2xl p-8 max-w-md w-full shadow-sm border border-outline-variant/20 text-center">
        {info.room_avatar_url ? (
          <Image
            src={info.room_avatar_url}
            alt={info.room_name}
            width={80}
            height={80}
            className="rounded-full mx-auto mb-4 object-cover"
            unoptimized
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary-container/40 flex items-center justify-center mx-auto mb-4">
            <MaterialIcon name="groups" className="text-4xl text-primary" />
          </div>
        )}

        <h2 className="text-headline-md text-on-surface mb-1">
          Te invitaron a unirte a
        </h2>
        <h1 className="font-display text-display-sm text-primary mb-2">
          {info.room_name}
        </h1>
        <p className="text-body-md text-on-surface-variant mb-1">
          {info.member_count} miembro{info.member_count !== 1 ? "s" : ""}
        </p>

        {info.requires_approval && (
          <p className="text-label-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            <MaterialIcon name="shield" className="text-sm align-middle mr-1" />
            Requiere aprobacion de un administrador
          </p>
        )}

        {info.expired && (
          <p className="text-label-sm text-error bg-error-container/20 rounded-lg px-3 py-2 mb-4">
            Este enlace ha expirado
          </p>
        )}
        {info.revoked && (
          <p className="text-label-sm text-error bg-error-container/20 rounded-lg px-3 py-2 mb-4">
            Este enlace fue revocado
          </p>
        )}
        {info.uses_exhausted && (
          <p className="text-label-sm text-error bg-error-container/20 rounded-lg px-3 py-2 mb-4">
            Se alcanzo el limite de usos
          </p>
        )}

        {joined ? (
          <div className="mb-4">
            <MaterialIcon name="check_circle" className="text-4xl text-green-600 mb-2" />
            <p className="text-body-md text-green-700">
              {error || "¡Te has unido al grupo!"}
            </p>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-error-container/10 border border-error/30 rounded-lg px-3 py-2 mb-3 text-body-sm text-error">
                {error}
              </div>
            )}
            <button
              onClick={handleJoin}
              disabled={!canJoin || joining}
              className={`w-full px-6 py-3 rounded-xl font-medium text-body-md ${
                canJoin
                  ? "bg-primary text-on-primary hover:opacity-90"
                  : "bg-surface-container-high text-on-surface-variant cursor-not-allowed"
              } transition-colors`}
            >
              {joining ? (
                <span className="flex items-center justify-center gap-2">
                  <MaterialIcon name="progress_activity" className="text-lg animate-spin" />
                  Uniendo...
                </span>
              ) : (
                "Unirse al grupo"
              )}
            </button>
          </>
        )}

        <button
          onClick={() => router.push("/messages")}
          className="mt-4 text-label-md text-on-surface-variant hover:text-primary transition-colors"
        >
          Ir a mensajes
        </button>
      </div>
    </div>
  );
}