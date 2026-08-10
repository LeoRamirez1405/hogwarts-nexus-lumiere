import { isStoredUpload } from "@/lib/media";

export function isLocalUpload(src?: string): boolean {
  return isStoredUpload(src);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
