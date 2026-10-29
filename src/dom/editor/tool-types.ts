import type { EntryHandle } from "../entry.js";
import type { EditorController, FieldSelection } from "./controller.js";
import type { OverlayController } from "./overlays.js";
import type { DomLocalization } from "../localization.js";
export interface ToolMount {
  root: HTMLElement;
  entry: EntryHandle;
  controller: EditorController;
  overlays: OverlayController;
  localization: DomLocalization;
}
export interface ToolHandle {
  update(): void;
  destroy(): void;
}
export interface TextToolRequest {
  tool:
    "color" | "gradient" | "placeholder" | "rainbow" | "decorations" | "sprite";
  anchor: HTMLElement;
  selection: FieldSelection;
}
