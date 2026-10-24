export interface PngImage {
  width: number;
  height: number;
  end: number;
  animated: boolean;
  staticBytes: Uint8Array;
}
const animationChunk = (type: string) =>
  type === "acTL" || type === "fcTL" || type === "fdAT";
/** Inspect framing only; preserve compressed pixels and all non-animation chunks. */
export function inspectPng(bytes: Uint8Array): PngImage | null {
  if (
    bytes.length < 45 ||
    ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  )
    return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const typeAt = (offset: number) =>
    String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
  if (view.getUint32(8) !== 13 || typeAt(8) !== "IHDR") return null;
  const width = view.getUint32(16),
    height = view.getUint32(20);
  if (!width || !height) return null;
  let idat = false,
    removed = 0;
  for (let offset = 8; offset <= bytes.length - 12;) {
    const length = view.getUint32(offset),
      type = typeAt(offset);
    if (length > bytes.length - offset - 12) return null;
    const next = offset + length + 12;
    if (animationChunk(type)) removed += length + 12;
    if (type === "IDAT") idat = true;
    if (type === "IEND") {
      if (!idat || length !== 0) return null;
      const staticBytes = removed
        ? new Uint8Array(next - removed)
        : bytes.subarray(0, next);
      if (removed) {
        staticBytes.set(bytes.subarray(0, 8));
        let write = 8;
        for (let read = 8; read < next;) {
          const end = read + view.getUint32(read) + 12;
          if (!animationChunk(typeAt(read))) {
            staticBytes.set(bytes.subarray(read, end), write);
            write += end - read;
          }
          read = end;
        }
      }
      return { width, height, end: next, animated: removed > 0, staticBytes };
    }
    offset = next;
  }
  return null;
}
