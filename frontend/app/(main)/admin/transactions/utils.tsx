import { Transaction } from "@/lib/api";

export function formatAmount(amount: number) {
  return amount.toLocaleString();
}

export function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function txIcon(type: Transaction["type"]) {
  switch (type) {
    case "deposit":
      return { icon: "arrow_downward", color: "bg-success/10 text-success" };
    case "withdrawal":
      return { icon: "arrow_upward", color: "bg-error/10 text-error" };
    case "transfer":
      return { icon: "swap_horiz", color: "bg-primary/10 text-primary" };
    case "purchase":
      return { icon: "shopping_cart", color: "bg-secondary/10 text-secondary" };
    default:
      return { icon: "receipt_long", color: "bg-surface-container-high text-on-surface-variant" };
  }
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const TX_TYPE_LABELS: Record<Transaction["type"], string> = {
  deposit: "Depósito",
  withdrawal: "Retiro",
  transfer: "Transferencia",
  purchase: "Compra",
};

export function txTypeLabel(type: Transaction["type"]): string {
  return TX_TYPE_LABELS[type] ?? type;
}

export function getActorName(tx: Transaction): string {
  if (tx.type === "deposit") {
    return tx.receiver?.name || (tx.receiver_id ? "Desconocido" : "—");
  }
  if (tx.type === "withdrawal" || tx.type === "purchase") {
    return tx.sender?.name || (tx.sender_id ? "Desconocido" : "—");
  }
  if (tx.type === "transfer") {
    const sender = tx.sender?.name || (tx.sender_id ? "Desconocido" : "—");
    const receiver = tx.receiver?.name || (tx.receiver_id ? "Desconocido" : "—");
    return `${sender} → ${receiver}`;
  }
  return "—";
}

export function getActorAvatar(tx: Transaction): string | undefined {
  if (tx.type === "deposit") {
    return tx.receiver?.avatar_url;
  }
  if (tx.type === "transfer") {
    return tx.sender?.avatar_url;
  }
  return tx.sender?.avatar_url;
}

export function getAmountPrefix(type: Transaction["type"]): string {
  if (type === "deposit") return "+";
  if (type === "withdrawal" || type === "purchase") return "-";
  return "";
}

export function getAmountColor(type: Transaction["type"]): string {
  if (type === "deposit") return "text-success";
  if (type === "withdrawal" || type === "purchase") return "text-error";
  return "text-on-surface";
}