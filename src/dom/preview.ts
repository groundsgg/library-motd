import { createEntry } from "./entry.js";
import type { PreviewOptions, PreviewHandle } from "./render.js";
export { element, applyTextStyle, renderText } from "./render.js";
export type { PreviewOptions, PreviewHandle } from "./render.js";

export function createPreview(
  host: HTMLElement,
  options: PreviewOptions,
): PreviewHandle {
  const entry = createEntry(host, options);
  return {
    update: entry.update,
    destroy: entry.destroy,
    getDiagnostics: entry.getDiagnostics,
  };
}
