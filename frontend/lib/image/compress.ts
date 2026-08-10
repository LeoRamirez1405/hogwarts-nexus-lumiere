// Compresion automatica de imagenes antes de subirlas al backend.
// Redimensiona a un ancho maximo y re-encodea a JPEG para que las subidas
// no ocupen de mas. Se aplica solo a imagenes raster grandes; los demas
// archivos (gif animado, video, audio, pdf, etc.) pasan sin cambios.

export const IMAGE_COMPRESS = {
  maxDimension: 1600,
  quality: 0.82,
  minBytes: 800 * 1024, // solo comprimir si supera 800 KB
};

function isCompressible(file: File): boolean {
  if (!file.type.startsWith("image/")) return false;
  if (file.size < IMAGE_COMPRESS.minBytes) return false;
  return file.type !== "image/gif"; // los GIF animados se pierden al re-encodear
}

export async function compressImageFile(file: File): Promise<File> {
  if (!isCompressible(file)) return file;
  if (typeof createImageBitmap === "undefined" || typeof document === "undefined") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      IMAGE_COMPRESS.maxDimension / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", IMAGE_COMPRESS.quality)
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
