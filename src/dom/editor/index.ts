import type { TextFormat } from "../../core/model.js";
import { parseText } from "../../core/text/parse.js";
import { serializeText } from "../../core/text/serialize.js";
import { element } from "../render.js";
import { createEntry } from "../entry.js";
import { mountProperties } from "../properties.js";
import { createEditorController } from "./controller.js";
import { createOverlays } from "./overlays.js";
import { mountToolbar } from "./toolbar.js";
import { mountTextTools } from "./text-tools.js";
import { mountStatusTools } from "./status-tools.js";
import type {
  EditorOptions,
  EditorHandle,
  Feature,
  EditorCommand,
} from "./types.js";
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
    chrome = element(doc, "div", "mce-chrome"),
    canvas = element(doc, "div", "mce-canvas"),
    extras = element(doc, "div", "mce-extras");
  const diagnostics = element(doc, "div", "mce-diagnostics");
  diagnostics.role = "status";
  root.append(chrome, canvas, extras, diagnostics);
  host.append(root);
  const controller = createEditorController(initial),
    entry = createEntry(canvas, initial);
  const motdHost = element(doc, "div", "");
  let options = initial,
    current = controller.getDocument(),
    destroyed = false,
    sourceMode = false,
    sourceFormat: TextFormat = "minimessage",
    signature = "",
    localErrors: string[] = [];
  const dispose: (() => void)[] = [];
  const label = (key: string, fallback: string) =>
    options.labels?.[key] ?? fallback;
  const locked = () => !!options.readOnly || !!options.disabled;
  const enabled = (field: Feature) => options.features?.[field] !== false;
  const execute = (command: EditorCommand) => controller.execute(command);
  function showErrors() {
    const messages = [
      ...new Set([
        ...localErrors,
        ...controller.getDiagnostics().map((d) => d.message),
        ...entry.getDiagnostics().map((d) => d.message),
      ]),
    ];
    diagnostics.textContent = messages.join("\n");
    diagnostics.hidden = !messages.length;
  }
  function button(
    parent: HTMLElement,
    text: string,
    name: string,
    action: () => void,
    disabled = locked(),
  ) {
    const b = element(doc, "button", "mce-button", text);
    b.type = "button";
    b.setAttribute("aria-label", name);
    b.title = name;
    b.disabled = disabled;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", action);
    parent.append(b);
    return b;
  }
  function fields() {
    if (enabled("motd")) controller.mountText("motd", motdHost);
    entry.bindText("motd", enabled("motd") ? motdHost : null);
  }
  function rebuild() {
    for (const fn of dispose.splice(0)) fn();
    root
      .querySelectorAll(".mce-properties,.mce-icon-upload")
      .forEach((node) => node.remove());
    chrome.replaceChildren();
    extras.replaceChildren();
    const tabs = element(doc, "div", "mce-tabs");
    chrome.append(tabs);
    button(
      tabs,
      label("visual", "Visual"),
      "Visual",
      () => {
        sourceMode = false;
        rebuild();
      },
      false,
    );
    button(
      tabs,
      label("source", "Source"),
      "Source",
      () => {
        sourceMode = true;
        rebuild();
      },
      false,
    );
    const format = element(doc, "select", "mce-source-format");
    format.setAttribute("aria-label", label("sourceFormat", "Source format"));
    format.hidden = !sourceMode;
    for (const [value, name] of [
      ["minimessage", "MiniMessage"],
      ["legacy-ampersand", "Legacy &"],
      ["legacy-section", "Legacy §"],
      ["properties", "server.properties"],
      ["json", "JSON components"],
    ]) {
      const option = element(doc, "option", "", name);
      option.value = value!;
      format.append(option);
    }
    format.value = sourceFormat;
    extras.append(format);
    const source = element(doc, "textarea", "mce-source");
    source.setAttribute("aria-label", label("motdSource", "MOTD source"));
    source.spellcheck = false;
    source.rows = 4;
    source.hidden = !sourceMode;
    source.disabled = locked() || !enabled("motd");
    source.value =
      serializeText(current.motd.text, {
        format: sourceFormat,
        rgb: sourceFormat !== "properties",
      }).value ??
      current.motd.text.source?.value ??
      "";
    format.addEventListener("change", () => {
      const next = format.value as TextFormat,
        result = serializeText(controller.getDocument().motd.text, {
          format: next,
          rgb: next !== "properties",
        });
      if (result.value === null) {
        format.value = sourceFormat;
        localErrors = result.diagnostics.map((d) => d.message);
        showErrors();
        return;
      }
      sourceFormat = next;
      source.value = result.value;
    });
    source.addEventListener("input", () => {
      if (locked() || !enabled("motd")) return;
      const parsed = parseText(source.value, sourceFormat);
      if (!parsed.value) {
        localErrors = parsed.diagnostics.map((d) => d.message);
        showErrors();
        return;
      }
      localErrors = [];
      execute({
        type: "replace-source",
        source: source.value,
        format: sourceFormat,
        field: "motd",
      });
    });
    extras.append(source);
    mountProperties({
      root,
      getOptions: controller.getOptions,
      getDocument: controller.getDocument,
      execute,
      onDispose: (fn) => dispose.push(fn),
    });
    showErrors();
  }
  function render(force = false) {
    if (destroyed || controller.isComposing()) return;
    options = controller.getOptions();
    current = controller.getDocument();
    entry.update({
      document: current,
      context: options.context,
      labels: options.labels,
    });
    fields();
    const next = JSON.stringify([
      options.features,
      options.labels,
      options.readOnly,
      options.disabled,
      current.version.mode,
      current.hover.mode,
      current.players.online.mode,
      current.players.maximum.mode,
      !!current.icon,
    ]);
    if (force || signature !== next) {
      signature = next;
      rebuild();
    }
    showErrors();
    for (const tool of tools) tool.update();
  }
  const overlays = createOverlays(root);
  const mount = { root, entry, controller, overlays };
  const tools = [
    mountToolbar(mount),
    mountTextTools(mount),
    mountStatusTools(mount),
  ];
  const unsubscribe = controller.subscribe((event) => {
    if (event === "selection") return;
    if (event === "diagnostics") {
      showErrors();
      return;
    }
    render(event === "options" || event === "replace");
  });
  render(true);
  return {
    execute,
    getDocument: controller.getDocument,
    focus: controller.focus,
    update(next) {
      controller.update(next);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      dispose.splice(0).forEach((fn) => fn());
      for (const tool of tools) tool.destroy();
      overlays.destroy();
      controller.destroy();
      entry.destroy();
      root.remove();
    },
  };
}
