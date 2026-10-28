/**
 * Utility for client-side image compression.
 * Automatically resizes high-resolution smartphone camera photos (e.g. 3MB-15MB)
 * down to an optimal size (~150-300KB) while maintaining high text clarity
 * for Gemini AI OCR receipt & invoice processing.
 */

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savedPercent: number;
  wasCompressed: boolean;
  mimeType: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function compressImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.8
): Promise<CompressionResult> {
  const originalSize = file.size;

  // If not an image (e.g. PDF, CSV, Excel), return untouched
  const isImage =
    file.type.startsWith("image/") ||
    Boolean(file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp|gif|bmp|heic)$/));

  if (!isImage || typeof window === "undefined") {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savedPercent: 0,
      wasCompressed: false,
      mimeType: file.type || "application/octet-stream",
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      let needsResize = false;
      if (width > maxDimension || height > maxDimension) {
        needsResize = true;
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      // If image is already smaller than 300KB and dimensions are under maxDimension, keep it
      if (!needsResize && file.size <= 300 * 1024 && file.type === "image/jpeg") {
        return resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          savedPercent: 0,
          wasCompressed: false,
          mimeType: file.type,
        });
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        return resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          savedPercent: 0,
          wasCompressed: false,
          mimeType: file.type,
        });
      }

      // Solid white background for consistent contrast and crisp text
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || (blob.size >= originalSize && !needsResize)) {
            return resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              savedPercent: 0,
              wasCompressed: false,
              mimeType: file.type,
            });
          }

          const baseName = file.name.replace(/\.[^.]+$/, "");
          const newFileName = `${baseName}.jpg`;
          const compressedFile = new File([blob], newFileName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          const savedPercent = Math.max(
            0,
            Math.round(((originalSize - compressedFile.size) / originalSize) * 100)
          );

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize: compressedFile.size,
            savedPercent,
            wasCompressed: true,
            mimeType: "image/jpeg",
          });
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        savedPercent: 0,
        wasCompressed: false,
        mimeType: file.type,
      });
    };

    img.src = objectUrl;
  });
}

