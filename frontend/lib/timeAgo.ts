export function timeAgo(dateStr: string): string {
  const d = new Date(
    dateStr.endsWith("Z") || dateStr.includes("+")
      ? dateStr
      : dateStr + "Z",
  );
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes <= 0) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes} min`;
  if (hours < 24) return `hace ${hours} h`;
  if (days < 7) return `hace ${days} d`;
  return `${d.toLocaleDateString("es-ES")} ${d.toLocaleTimeString(
    "es-ES",
    { hour: "2-digit",
      minute: "2-digit" },
  )}`;
}