"use client";

export function MaterialIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
      }}
    >
      {name}
   </span>
  );
}

export function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
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
    "✨", "🔮", "🧙", "🧙‍♂️", "🧙‍♀️", "🪄", "🧪", "🔮", "🧿",
    "🦉", "🐱", "🐈‍⬛", "🦔", "🦊", "🐺", "🦁", "🐯", "🐻",
    "🐉", "🦄", "🧚", "🧚‍♀️", "🧚‍♂️", "🧝", "🧝‍♀️", "🧝‍♂️",
    "🏰", "🌙", "⭐", "☁️", "🌈", "💫", "🌟", "✨", "💎",
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
