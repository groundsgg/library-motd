import { element } from "../render.js";
import { createEntry } from "../entry.js";
import { createEditorController } from "./controller.js";
import { createOverlays } from "./overlays.js";
import { mountToolbar } from "./toolbar.js";
import { mountTextTools } from "./text-tools.js";
import { mountStatusTools } from "./status-tools.js";
import { mountIconTool } from "./icon-tool.js";
import { mountTransferTools } from "./transfer-tools.js";
import type { EditorOptions, EditorHandle } from "./types.js";
export type {
  EditableField,
  Feature,
  EditorOptions,
  EditorChange,
  EditorCommand,
  EditorHandle,
  ImportAdapter,
  EditorExtension,
  EditorExtensionFactory,
} from "./types.js";

export function createEditor(
  host: HTMLElement,
  initial: EditorOptions,
): EditorHandle {
  const doc = host.ownerDocument,
    root = element(doc, "section", "mce-root"),
    canvas = element(doc, "div", "mce-canvas"),
    diagnostics = element(doc, "div", "mce-diagnostics"),
    motdHost = element(doc, "div", "");
  diagnostics.role = "status";
  root.append(canvas, diagnostics);
  host.append(root);
  const controller = createEditorController(initial),
    entry = createEntry(canvas, initial),
    overlays = createOverlays(root),
    mount = { root, entry, controller, overlays };
  let destroyed = false;
  function showErrors() {
    const messages = [
      ...new Set(
        [...controller.getDiagnostics(), ...entry.getDiagnostics()].map(
          (d) => d.message,
        ),
      ),
    ];
    diagnostics.textContent = messages.join("\n");
    diagnostics.hidden = !messages.length;
  }
  const tools = [
    mountToolbar(mount),
    mountTextTools(mount),
    mountStatusTools(mount),
    mountIconTool(mount),
    mountTransferTools(mount),
  ];
  function render() {
    if (destroyed || controller.isComposing()) return;
    const options = controller.getOptions();
    entry.update({
      document: controller.getDocument(),
      context: options.context,
      labels: options.labels,
    });
    const available = options.features?.motd !== false;
    if (available) controller.mountText("motd", motdHost);
    entry.bindText("motd", available ? motdHost : null);
    showErrors();
    for (const tool of tools) tool.update();
    overlays.reposition();
  }
  const unsubscribe = controller.subscribe((event) => {
    if (event === "selection") return;
    if (event === "diagnostics") showErrors();
    else render();
  });
  render();
  return {
    execute: controller.execute,
    getDocument: controller.getDocument,
    focus: controller.focus,
    update: controller.update,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      for (const tool of tools) tool.destroy();
      overlays.destroy();
      controller.destroy();
      entry.destroy();
      root.remove();
    },
  };
}
