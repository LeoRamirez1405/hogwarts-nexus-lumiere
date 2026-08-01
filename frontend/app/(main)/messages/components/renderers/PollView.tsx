"use client";

import type { PollViewProps } from "./types";

export const PollView = ({ poll, isOwn }: PollViewProps) => {
  if (!poll) return null;

  const totalVotes = poll.total_votes;

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
          return (
            <div key={opt.id} className="flex items-center gap-2">
              <div
                className={`flex-1 h-8 rounded-full transition-all overflow-hidden ${
                  opt.voted_by_me
                    ? isOwn ? "bg-white/25" : "bg-primary"
                    : isOwn ? "bg-white/10" : "bg-surface-container-high"
                }`}
                style={{ width: `${Math.max(pct, 8)}%`, minWidth: "60px" }}
              >
                <span
                  className={`flex items-center justify-end pr-2 text-label-sm h-full font-medium ${
                    opt.voted_by_me
                      ? isOwn ? "text-white" : "text-on-primary"
                      : isOwn ? "text-white/80" : "text-on-surface"
                  }`}
                >
                  {opt.label}
                </span>
              </div>
              <div className={`w-16 text-right text-label-sm font-medium ${isOwn ? "text-white/70" : "text-on-surface-variant"}`}>
                {opt.votes_count}{" "}
                {totalVotes > 0 ? `(${Math.round(pct)}%)` : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`flex items-center justify-between mt-3 pt-2 border-t ${isOwn ? "border-white/20" : "border-outline-variant/30"}`}>
        <span className={`text-label-sm font-medium ${isOwn ? "text-white/70" : "text-on-surface-variant"}`}>
          {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
        </span>
        {poll.multi_choice && (
          <span className={`text-label-sm font-medium ${isOwn ? "text-white/80" : "text-primary"}`}>
            Multiple opcion
          </span>
        )}
      </div>
    </div>
  );
};