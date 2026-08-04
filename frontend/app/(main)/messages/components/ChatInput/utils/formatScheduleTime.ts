export function formatScheduleTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return "Pasado";
    if (diff < 60000) return "En menos de 1 min";
    if (diff < 3600000) return `En ${Math.ceil(diff / 60000)} min`;
    if (diff < 86400000) return `En ${Math.ceil(diff / 3600000)} h`;
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Programado";
  }
}