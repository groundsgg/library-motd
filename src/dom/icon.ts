import type { IconValue, Outcome } from "../core/model.js";
import { failure } from "../core/diagnostics.js";
import { staticIconSource } from "./icon-source.js";
export interface IconOptions {
  crop?: { x: number; y: number; width: number; height: number };
  maxBytes?: number;
  maxPixels?: number;
}
function dimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)
  )
    return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes[0] !== 255 || bytes[1] !== 216) return null;
  for (let p = 2; p + 8 < bytes.length;) {
    if (bytes[p++] !== 255) return null;
    const marker = bytes[p++]!;
    if (marker === 217 || marker === 218) break;
    if (marker === 0 || marker === 255) continue;
    const size = view.getUint16(p);
    if (size < 2 || p + size > bytes.length) return null;
    if (
      [
        192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
      ].includes(marker)
    )
      return { height: view.getUint16(p + 3), width: view.getUint16(p + 5) };
    p += size;
  }
  return null;
}
export async function normalizeIcon(
  input: Blob,
  options: IconOptions = {},
): Promise<Outcome<IconValue>> {
  if (input.size > (options.maxBytes ?? 10 * 1024 * 1024))
    return failure("image-limit", "icon", { key: "diagnostic.imageBytes" });
  if (!["image/png", "image/apng", "image/jpeg"].includes(input.type))
    return failure("invalid-image", "icon", { key: "diagnostic.imageFormat" });
  const bytes = new Uint8Array(await input.arrayBuffer()),
    size = dimensions(bytes);
  if (!size || !size.width || !size.height)
    return failure("invalid-image", "icon", { key: "diagnostic.imageHeader" });
  if (size.width * size.height > (options.maxPixels ?? 16_000_000))
    return failure("image-limit", "icon", { key: "diagnostic.imagePixels" });
  let image: ImageBitmap | undefined;
  try {
    const prepared = staticIconSource(input, bytes);
    image = await createImageBitmap(prepared.source);
    const side = Math.min(image.width, image.height),
      crop = options.crop ?? {
        x: Math.floor((image.width - side) / 2),
        y: Math.floor((image.height - side) / 2),
        width: side,
        height: side,
      };
    if (
      !Object.values(crop).every(Number.isFinite) ||
      crop.x < 0 ||
      crop.y < 0 ||
      crop.width <= 0 ||
      crop.width !== crop.height ||
      crop.x + crop.width > image.width ||
      crop.y + crop.height > image.height
    )
      return failure("invalid-crop", "icon", { key: "diagnostic.invalidCrop" });
    const canvas = globalThis.document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      64,
      64,
    );
    return {
      value: { pngBase64: canvas.toDataURL("image/png").split(",")[1]! },
      diagnostics: prepared.diagnostics,
    };
  } catch {
    return failure("invalid-image", "icon", { key: "diagnostic.imageDecode" });
  } finally {
    image?.close();
  }
}
