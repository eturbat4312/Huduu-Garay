const MAX_LISTING_IMAGE_DIMENSION = 1920;
const LISTING_IMAGE_QUALITY = 0.88;

async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(file);
  }
}

export async function compressListingImage(file: File): Promise<File> {
  if (typeof window === "undefined" || typeof createImageBitmap === "undefined") {
    return file;
  }

  const bitmap = await loadBitmap(file);
  try {
    const scale = Math.min(
      1,
      MAX_LISTING_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return file;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", LISTING_IMAGE_QUALITY);
    });

    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "listing-photo";
    return new File([blob], `${baseName}.jpg`, {
      type: blob.type || "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}

export async function compressListingImages(files: File[]): Promise<File[]> {
  const compressed: File[] = [];
  for (const file of files) {
    compressed.push(await compressListingImage(file));
  }
  return compressed;
}
