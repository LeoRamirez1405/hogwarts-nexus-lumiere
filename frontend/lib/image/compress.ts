// Compresion automatica de imagenes antes de subirlas al backend.
// Redimensiona a un lado maximo y re-encodea a WebP (formato que el backend
// almacena y sirve tal cual, sin doble compresion). Si el navegador no
// soporta encode WebP, cae a JPEG con fondo blanco. Se aplica solo a imagenes
// raster grandes; los demas archivos (gif animado, video, audio, pdf, etc.)
// pasan sin cambios.

export const IMAGE_COMPRESS = {
  maxDimension: 1600,
  quality: 0.8,
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

  const baseName = file.name.replace(/\.[^.]+$/, "");

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      IMAGE_COMPRESS.maxDimension / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const draw = (ctx: CanvasRenderingContext2D) => {
      ctx.drawImage(bitmap, 0, 0, width, height);
    };

    // WebP conserva el canal alpha (a diferencia del JPEG).
    const webpCanvas = document.createElement("canvas");
    webpCanvas.width = width;
    webpCanvas.height = height;
    const webpCtx = webpCanvas.getContext("2d");
    if (webpCtx) {
      webpCtx.clearRect(0, 0, width, height);
      draw(webpCtx);
      const webp = await new Promise<Blob | null>((resolve) =>
        webpCanvas.toBlob(resolve, "image/webp", IMAGE_COMPRESS.quality)
      );
      if (webp) {
        bitmap.close();
        return new File([webp], `${baseName}.webp`, { type: "image/webp" });
      }
    }

    // Fallback JPEG: fondo blanco (el JPEG no tiene alpha).
    const jpegCanvas = document.createElement("canvas");
    jpegCanvas.width = width;
    jpegCanvas.height = height;
    const jpegCtx = jpegCanvas.getContext("2d");
    if (jpegCtx) {
      jpegCtx.fillStyle = "#ffffff";
      jpegCtx.fillRect(0, 0, width, height);
      draw(jpegCtx);
      const jpeg = await new Promise<Blob | null>((resolve) =>
        jpegCanvas.toBlob(resolve, "image/jpeg", IMAGE_COMPRESS.quality)
      );
      if (jpeg) {
        bitmap.close();
        return new File([jpeg], `${baseName}.jpg`, { type: "image/jpeg" });
      }
    }

    bitmap.close();
    return file;
  } catch {
    return file;
  }
}
