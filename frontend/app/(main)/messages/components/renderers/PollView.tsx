"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { MaterialIcon } from "@/components/ui";
import { toastError } from "@/lib/toastStore";
import type { PollViewProps } from "./types";
import type { PollResponse, PollOptionResponse } from "@/lib/api/messagesTypes";

function recalc(poll: PollResponse): PollResponse {
  const total = poll.options.reduce((s, o) => s + o.votes_count, 0);
  return { ...poll, total_votes: total };
}

export const PollView = ({ poll, isOwn, messageId, onVoteChange }: PollViewProps) => {
  const [busy, setBusy] = useState<string | null>(null);
  if (!poll) return null;

  const totalVotes = poll.total_votes;

  const handleVote = async (opt: PollOptionResponse) => {
    if (busy) return;
    setBusy(opt.id);
    try {
      if (opt.voted_by_me) {
        // Quitar voto existente
        await api.removePollVote(messageId, opt.id);
        const updated: PollResponse = {
          ...poll,
          options: poll.options.map((o) =>
            o.id === opt.id
              ? { ...o, voted_by_me: false, votes_count: Math.max(0, o.votes_count - 1) }
              : o
          ),
        };
        onVoteChange?.(messageId, recalc(updated));
      } else if (!poll.multi_choice) {
        // Single-choice: workaround para bug del backend (no borra voto previo).
        // 1) Quitar voto anterior si existe
        const prev = poll.options.find((o) => o.voted_by_me);
        if (prev) {
          await api.removePollVote(messageId, prev.id);
        }
        // 2) Votar nueva opción
        await api.votePoll(messageId, [opt.id]);
        const updated: PollResponse = {
          ...poll,
          options: poll.options.map((o) => {
            if (o.id === opt.id) {
              return { ...o, voted_by_me: true, votes_count: o.votes_count + 1 };
            }
            if (prev && o.id === prev.id) {
              return { ...o, voted_by_me: false, votes_count: Math.max(0, o.votes_count - 1) };
            }
            return o;
          }),
        };
        onVoteChange?.(messageId, recalc(updated));
      } else {
        // Multi-choice: votar directamente
        await api.votePoll(messageId, [opt.id]);
        const updated: PollResponse = {
          ...poll,
          options: poll.options.map((o) =>
            o.id === opt.id
              ? { ...o, voted_by_me: true, votes_count: o.votes_count + 1 }
              : o
          ),
        };
        onVoteChange?.(messageId, recalc(updated));
      }
    } catch (err) {
      toastError("No se pudo registrar tu voto", err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={`mt-2 p-3 rounded-xl border ${
        isOwn
          ? "bg-white/10 border-white/20"
          : "bg-white border-outline-variant/30"
      }`}
    >
      <p className={`text-body-md font-semibold mb-2 ${isOwn ? "text-white" : "text-on-surface"}`}>
        {poll.question}
      </p>
      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const pct = totalVotes > 0 ? (opt.votes_count / totalVotes) * 100 : 0;
          const isBusy = busy === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleVote(opt)}
              disabled={busy !== null}
              title={opt.voted_by_me ? "Tocar para quitar tu voto" : "Votar esta opción"}
              className={`w-full relative h-9 rounded-full overflow-hidden text-left flex items-center transition-all border ${
                opt.voted_by_me
                  ? isOwn
                    ? "bg-white/25 border-white/40"
                    : "bg-primary border-primary"
                  : isOwn
                    ? "bg-white/10 border-transparent hover:bg-white/15"
                    : "bg-surface-container-high border-outline-variant/20 hover:bg-surface-container-highest"
              } ${busy !== null && !isBusy ? "opacity-60" : ""}`}
            >
              <span
                className={`absolute left-0 top-0 bottom-0 transition-all ${
                  opt.voted_by_me
                    ? isOwn ? "bg-white/10" : "bg-primary/30"
                    : isOwn ? "bg-white/5" : "bg-surface-container-highest/80"
                }`}
                style={{ width: `${Math.max(pct, 8)}%` }}
                aria-hidden="true"
              />
              <span
                className={`relative z-10 pl-3 pr-2 flex-1 flex items-center gap-1 truncate text-label-sm ${
                  opt.voted_by_me
                    ? isOwn ? "text-white font-bold" : "text-on-primary font-bold"
                    : isOwn ? "text-white/80" : "text-on-surface"
                }`}
              >
                {opt.voted_by_me && (
                  <MaterialIcon name="check" className="text-base shrink-0" />
                )}
                <span className="truncate">{opt.label}</span>
              </span>
              <span
                className={`relative z-10 pr-3 pl-1 text-label-sm font-medium ${
                  opt.voted_by_me
                    ? isOwn ? "text-white" : "text-on-primary"
                    : isOwn ? "text-white/70" : "text-on-surface-variant"
                }`}
              >
                {opt.votes_count}
                {totalVotes > 0 ? ` · ${Math.round(pct)}%` : ""}
              </span>
            </button>
          );
        })}
      </div>
      <div
        className={`flex items-center justify-between mt-3 pt-2 border-t ${
          isOwn ? "border-white/20" : "border-outline-variant/30"
        }`}
      >
        <span
          className={`text-label-sm font-medium ${
            isOwn ? "text-white/70" : "text-on-surface-variant"
          }`}
        >
          {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
        </span>
        <span
          className={`text-label-sm font-medium ${
            isOwn ? "text-white/80" : "text-primary"
          }`}
        >
          {poll.multi_choice ? "Múltiple opción" : "Una opción"}
        </span>
      </div>
    </div>
  );
};
