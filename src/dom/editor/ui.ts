import { element } from "../render.js";
import type { ToolMount } from "./tool-types.js";
import type { TextStyle } from "../../core/model.js";
import type { EditableField } from "./types.js";
export const toolLabel = (mount: ToolMount, key: string, fallback: string) =>
  mount.controller.getOptions().labels?.[key] ?? fallback;
export const toolLocked = (mount: ToolMount) =>
  !!(
    mount.controller.getOptions().readOnly ||
    mount.controller.getOptions().disabled
  );
export function fieldEditable(mount: ToolMount, field: EditableField): boolean {
  const state = mount.controller.getDocument();
  return (
    !toolLocked(mount) &&
    mount.controller.getOptions().features?.[field] !== false &&
    (field !== "version" || state.version.mode !== "automatic") &&
    (field !== "hover" || state.hover.mode === "custom")
  );
}
export function toolButton(
  doc: Document,
  text: string,
  label: string,
  action: () => void,
): HTMLButtonElement {
  const button = element(doc, "button", "mce-button", text);
  button.type = "button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.addEventListener("click", action);
  return button;
}
export function toolField(
  doc: Document,
  label: string,
  input: HTMLElement,
): HTMLLabelElement {
  const field = element(doc, "label", "mce-tool-field", label);
  input.setAttribute("aria-label", label);
  field.append(input);
  return field;
}
export function activeStyle(mount: ToolMount): TextStyle {
  const view = mount.controller.getView(mount.controller.getActiveField());
  const mark = (
    view?.state.storedMarks ?? view?.state.selection.$from.marks()
  )?.find((mark) => mark.type.name === "format");
  return Object.assign(
    {},
    ...(mark?.attrs.path ?? []).map((part: { style: TextStyle }) => part.style),
  );
}
