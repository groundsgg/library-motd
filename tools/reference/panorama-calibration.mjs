import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

/** Original calibration data: red encodes face, green/blue encode image u/v. */
export function calibrationFaces(size = 256) {
  return Array.from({ length: 6 }, (_, face) => {
    const image = new PNG({ width: size, height: size });
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const offset = (y * size + x) * 4;
        image.data.set(
          [
            32 + face * 32,
            Math.round((x * 255) / (size - 1)),
            Math.round((y * 255) / (size - 1)),
            255,
          ],
          offset,
        );
      }
    return PNG.sync.write(image);
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const directory = process.argv[2];
  if (!directory)
    throw new Error(
      "Usage: node tools/reference/panorama-calibration.mjs <output-directory>",
    );
  await mkdir(directory, { recursive: true });
  const hashes = [];
  for (const [index, bytes] of calibrationFaces().entries()) {
    const name = `panorama_${index}.png`;
    await writeFile(resolve(directory, name), bytes);
    hashes.push({
      file: name,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  await writeFile(
    resolve(directory, "calibration.json"),
    JSON.stringify(
      {
        origin: "Original RGB face/u/v calibration; no game image data",
        cases: hashes,
      },
      null,
      2,
    ) + "\n",
  );
}
