"use client";

import { Transaction } from "@/lib/api";
import { Badge, MaterialIcon } from "@/components/ui";

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: Transaction["status"]) {
  switch (status) {
    case "completed":
      return "success";
    case "confirmed":
      return "primary";
    case "pending":
      return "secondary";
    default:
      return "default";
  }
}

function txIcon(type: Transaction["type"]) {
  switch (type) {
    case "deposit":
      return { icon: "arrow_downward", color: "bg-success/10 text-success" };
    case "withdrawal":
      return { icon: "arrow_upward", color: "bg-error/10 text-error" };
    case "transfer":
      return { icon: "swap_horiz", color: "bg-primary/10 text-primary" };
    default:
      return { icon: "receipt_long", color: "bg-surface-container-high text-on-surface-variant" };
  }
}

interface HistoryTabProps {
  transactions: Transaction[];
  currentUserId?: string;
}

export function HistoryTab({ transactions, currentUserId }: HistoryTabProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <MaterialIcon
          name="receipt_long"
          className="text-6xl text-outline-variant/40 mb-4 block mx-auto"
        />
        <p className="text-on-surface-variant text-body-md">
          No hay transacciones en tu historial
       </p>
    </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => {
        const { icon, color } = txIcon(tx.type);
        const isCredit = tx.type === "deposit" || (tx.type === "transfer" && tx.receiver_id === currentUserId);
        return (
          <div
            key={tx.id}
            className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low/50 hover:bg-surface-container-high transition-colors"
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${color}`}
            >
              <MaterialIcon name={icon} className="text-xl" />
        </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md text-on-surface truncate">
                {tx.description || tx.type}
          </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-label-sm text-on-surface-variant">
                  {formatTime(tx.created_at)}
          </p>
                <Badge variant="tag" color={statusColor(tx.status)}>
                  {tx.status}
          </Badge>
        </div>
      </div>
            <div className="text-right shrink-0">
              <p
                className={`font-display text-title-md ${
                  isCredit ? "text-success" : "text-error"
                }`}
              >
                {isCredit ? "+" : "-"}
                {tx.amount.toLocaleString()}
          </p>
      </div>
    </div>
        );
      })}
  </div>
  );
}