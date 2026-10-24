import type { IconValue, Outcome } from "../model.js";
import { diagnostic, failure } from "../diagnostics.js";
import { inspectPng } from "./png.js";

function readIcon(value: unknown) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !("pngBase64" in value) ||
    typeof value.pngBase64 !== "string" ||
    value.pngBase64.length > 131072 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value.pngBase64)
  )
    return null;
  try {
    const raw = atob(value.pngBase64),
      bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
    const png = inspectPng(bytes);
    return png &&
      png.width === 64 &&
      png.height === 64 &&
      png.end === bytes.length
      ? png
      : null;
  } catch {
    return null;
  }
}
export const isStatusIcon = (value: unknown): value is IconValue =>
  !!readIcon(value);

/** Project Java's static/default PNG image without decoding/recompressing pixels. */
export function normalizeStatusIcon(icon: IconValue): Outcome<IconValue> {
  const png = readIcon(icon);
  if (!png)
    return failure("invalid-icon", "icon", { key: "diagnostic.invalidIcon" });
  if (!png.animated)
    return { value: { pngBase64: icon.pngBase64 }, diagnostics: [] };
  let binary = "";
  for (let offset = 0; offset < png.staticBytes.length; offset += 8192)
    binary += String.fromCharCode(
      ...png.staticBytes.subarray(offset, offset + 8192),
    );
  return {
    value: { pngBase64: btoa(binary) },
    diagnostics: [
      diagnostic(
        "animated-icon-static",
        "icon",
        { key: "diagnostic.staticIcon" },
        "warning",
      ),
    ],
  };
}
