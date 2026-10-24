import { PNG } from "pngjs";

export function pngChunk(type: string, data: Buffer): Buffer {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length);
  result.write(type, 4, "ascii");
  data.copy(result, 8);
  let crc = 0xffffffff;
  for (const byte of result.subarray(4, result.length - 4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
function parts(png: Buffer) {
  const result: { type: string; bytes: Buffer; data: Buffer }[] = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset),
      end = offset + length + 12;
    result.push({
      type: png.toString("ascii", offset + 4, offset + 8),
      bytes: png.subarray(offset, end),
      data: png.subarray(offset + 8, end - 4),
    });
    offset = end;
  }
  return result;
}
/** Original fixtures: translucent red default image; opaque blue animation. */
export function makeApng(defaultExcluded = true, size = 64) {
  const image = (color: number[]) => {
    const png = new PNG({ width: size, height: size });
    for (let i = 0; i < png.data.length; i += 4) png.data.set(color, i);
    png.data[3] = 0;
    return PNG.sync.write(png);
  };
  const defaultPng = image([255, 0, 0, 128]),
    blue = image([0, 0, 255, 255]);
  const original = parts(defaultPng),
    animation = parts(blue);
  const control = (sequence: number) => {
    const data = Buffer.alloc(26);
    data.writeUInt32BE(sequence, 0);
    data.writeUInt32BE(size, 4);
    data.writeUInt32BE(size, 8);
    data.writeUInt16BE(1, 20);
    data.writeUInt16BE(10, 22);
    return pngChunk("fcTL", data);
  };
  const ac = Buffer.alloc(8);
  ac.writeUInt32BE(defaultExcluded ? 1 : 2);
  const compressed = Buffer.concat(
    animation.filter((p) => p.type === "IDAT").map((p) => p.data),
  );
  const fd = Buffer.alloc(compressed.length + 4);
  fd.writeUInt32BE(defaultExcluded ? 1 : 2);
  compressed.copy(fd, 4);
  const png = Buffer.concat([
    defaultPng.subarray(0, 8),
    original.find((p) => p.type === "IHDR")!.bytes,
    pngChunk("acTL", ac),
    ...(defaultExcluded ? [] : [control(0)]),
    ...original.filter((p) => p.type === "IDAT").map((p) => p.bytes),
    control(defaultExcluded ? 0 : 1),
    pngChunk("fdAT", fd),
    original.find((p) => p.type === "IEND")!.bytes,
  ]);
  return { png, defaultPng };
}
