"use client";

export { MaterialIcon } from "@/components/ui";

function parseUtc(dateStr: string): Date {
  return new Date(dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z");
}

export function formatTimestamp(dateStr: string): string {
  const d = parseUtc(dateStr);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins <= 0) return "Ahora";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function formatMessageTime(dateStr: string): string {
  return parseUtc(dateStr).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function computeOnlineStatus(
  lastActiveAt?: string
): { text: string; status: "online" | "away" | "offline" } {
  if (!lastActiveAt) return { text: "Desconectado", status: "offline" };
  const diffMs = Date.now() - parseUtc(lastActiveAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (mins <= 5) return { text: "En linea", status: "online" };
  if (mins < 60) return { text: `Visto hace ${mins}m`, status: "away" };
  if (hrs < 24) return { text: `Visto hace ${hrs}h`, status: "offline" };
  if (days < 7) return { text: `Visto hace ${days}d`, status: "offline" };
  return {
    text: `Visto el ${parseUtc(lastActiveAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`,
    status: "offline",
  };
}

export function isOnline(lastActiveAt?: string): boolean {
  if (!lastActiveAt) return false;
  return Date.now() - parseUtc(lastActiveAt).getTime() < 300000; // 5 min
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getFileIcon(type: string): string {
  if (type.startsWith("image")) return "image";
  if (type.startsWith("video")) return "videocam";
  if (type.startsWith("audio")) return "audiotrack";
  if (type === "application/pdf") return "picture_as_pdf";
  if (type.includes("word") || type.includes("document")) return "description";
  return "attach_file";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const STICKER_PACKS: Record<string, string[]> = {
  magicos: [
    "✨", "🔮", "🧙", "🧙‍♂️", "🧙‍♀️", "🪄", "🧪", "🧿",
    "🦉", "🐱", "🐈‍⬛", "🦔", "🦊", "🐺", "🦁", "🐯", "🐻",
    "🐉", "🦄", "🧚", "🧚‍♀️", "🧚‍♂️", "🧝", "🧝‍♀️", "🧝‍♂️",
    "🏰", "🌙", "⭐", "☁️", "🌈", "💫", "🌟", "💎",
    "🎃", "📜", "🖋️", "📝", "📖", "📚", "🏷️", "🎓", "⚡",
  ],
  reacciones: [
    "😂", "😭", "😍", "😱", "😡", "👍", "👎", "👏", "🤔", "🤷‍♂️",
    "🙌", "🤝", "💪", "🙏", "🤞", "✌️", "🤟", "🤘", "🖖", "👋",
    "💯", "💩", "🤡", "👻", "🎃", "🎭", "🎪", "🎨", "🎯", "🎲",
  ],
  animales: [
    "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
    "🦁", "🐮", "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔",
    "🐧", "🐦", "🐤", "🐣", "🐥", "🦆", "🦅", "🦉", "🦇", "🐺",
  ],
};

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;

export function linkifyText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const url = match[1];
    parts.push(
      <a
        key={match.index}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline hover:opacity-80"
      >
        {url}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

export function hasUrl(text?: string): boolean {
  if (!text) return false;
  return URL_REGEX.test(text);
}
