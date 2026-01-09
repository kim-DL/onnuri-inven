import imageCompression from "browser-image-compression";

const MAX_IMAGE_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;
const LARGE_IMAGE_BYTES = 10 * 1024 * 1024;

type LoadedImage = {
  image: ImageBitmap | HTMLImageElement;
  cleanup: () => void;
};

async function loadImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, cleanup: () => bitmap.close() };
    } catch {
      // Fall back to HTMLImageElement.
    }
  }

  const img = new Image();
  img.decoding = "async";
  const objectUrl = URL.createObjectURL(file);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });

  return { image, cleanup: () => {} };
}

async function hasPngTransparency(file: File): Promise<boolean> {
  let loaded: LoadedImage | null = null;

  try {
    loaded = await loadImage(file);
    const { image } = loaded;
    const width =
      image instanceof HTMLImageElement ? image.naturalWidth : image.width;
    const height =
      image instanceof HTMLImageElement ? image.naturalHeight : image.height;

    if (!width || !height) {
      return true;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return true;
    }
    ctx.drawImage(image, 0, 0, width, height);

    const { data } = ctx.getImageData(0, 0, width, height);
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.warn("Failed to detect PNG transparency. Keeping PNG.", error);
    return true;
  } finally {
    loaded?.cleanup();
  }
}

export async function resizeImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) {
    return file;
  }

  if (file.size > LARGE_IMAGE_BYTES) {
    console.warn("Large image file detected. Resizing anyway.", {
      name: file.name,
      size: file.size,
    });
  }

  let outputType: "image/jpeg" | "image/png" | undefined;

  if (file.type === "image/png") {
    const keepPng = await hasPngTransparency(file);
    outputType = keepPng ? "image/png" : "image/jpeg";
  } else {
    outputType = "image/jpeg";
  }

  try {
    const compressedBlob: Blob = (await imageCompression(file, {
      maxWidthOrHeight: MAX_IMAGE_DIMENSION,
      initialQuality: JPEG_QUALITY,
      useWebWorker: true,
      fileType: outputType,
    })) as unknown as Blob;

    const finalType = compressedBlob.type || outputType || file.type;
    return new File([compressedBlob], file.name, {
      type: finalType,
      lastModified: file.lastModified,
    });
  } catch (error) {
    console.error("Failed to resize image. Uploading original.", error);
    return file;
  }
}
