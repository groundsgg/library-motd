import type { Diagnostic } from "../core/model.js";
import { diagnostic } from "../core/diagnostics.js";
import { inspectPng } from "../core/image/png.js";

/** Decode Java's static/default PNG image, never the browser's APNG frame choice. */
export function staticIconSource(
  input: Blob,
  bytes: Uint8Array,
): { source: Blob; diagnostics: Diagnostic[] } {
  const png = inspectPng(bytes);
  if (!png?.animated) return { source: input, diagnostics: [] };
  return {
    source: new Blob([Uint8Array.from(png.staticBytes)], { type: "image/png" }),
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
