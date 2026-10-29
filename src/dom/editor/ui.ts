import { element } from "../render.js";
import type { ToolMount } from "./tool-types.js";
import type { TextStyle } from "../../core/model.js";
import type { EditableField } from "./types.js";
import {
  setLabelAttribute,
  type LabelText,
  type LabelParameters,
} from "../localization.js";
export const toolLabel = (
  mount: ToolMount,
  key: string,
  fallback: LabelText,
  parameters?: LabelParameters,
) => mount.localization.message(key, fallback, parameters);
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
  text: LabelText,
  label: LabelText,
  action: () => void,
): HTMLButtonElement {
  const button = element(doc, "button", "mce-button", text);
  button.type = "button";
  setLabelAttribute(button, "aria-label", label);
  setLabelAttribute(button, "title", label);
  button.addEventListener("click", action);
  return button;
}
export function toolField(
  doc: Document,
  label: LabelText,
  input: HTMLElement,
): HTMLLabelElement {
  const field = element(doc, "label", "mce-tool-field", label);
  setLabelAttribute(input, "aria-label", label);
  field.append(input);
  return field;
}
export function activeStyle(mount: ToolMount): TextStyle {
  const view = mount.controller.getView(mount.controller.getActiveField());
  if (view && !view.state.selection.empty) {
    // AllSelection starts at the document boundary, whose marks are empty.
    // Mixed selections are active only for styles shared by editable leaves.
    const styles: TextStyle[] = [];
    view.state.doc.nodesBetween(
      view.state.selection.from,
      view.state.selection.to,
      (node) => {
        const path = node.isText
          ? node.marks.find((mark) => mark.type.name === "format")?.attrs.path
          : node.type.name === "token" &&
              ["placeholder", "sprite"].includes(node.attrs.node.type)
            ? node.attrs.path
            : undefined;
        if (node.isText || path)
          styles.push(
            Object.assign(
              {},
              ...(path ?? []).map((part: { style: TextStyle }) => part.style),
            ),
          );
      },
    );
    const common = { ...styles[0] };
    for (const style of styles.slice(1))
      for (const key of Object.keys(common) as (keyof TextStyle)[])
        if (JSON.stringify(common[key]) !== JSON.stringify(style[key]))
          delete common[key];
    return common;
  }
  const mark = (
    view?.state.storedMarks ?? view?.state.selection.$from.marks()
  )?.find((mark) => mark.type.name === "format");
  return Object.assign(
    {},
    ...(mark?.attrs.path ?? []).map((part: { style: TextStyle }) => part.style),
  );
}

export interface EntryToolAction {
  label: LabelText;
  enabled: boolean;
  action(): void;
}
/** Private, instance-scoped menu contributions from mounted tools. */
export function entryToolActions(
  root: HTMLElement,
  initial: EntryToolAction[] = [],
): EntryToolAction[] {
  root.dispatchEvent(
    new root.ownerDocument.defaultView!.CustomEvent<EntryToolAction[]>(
      "mce-entry-menu",
      { detail: initial },
    ),
  );
  return initial;
}
