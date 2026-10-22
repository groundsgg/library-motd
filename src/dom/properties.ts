import type { GradientStop, TextFormat } from "../core/model.js";
import { serializeText } from "../core/text/serialize.js";
import { importStatus } from "../core/status/import.js";
import { element } from "./preview.js";
import type { EditorExtension } from "./editor/index.js";
interface PropertyState {
  stops: GradientStop[];
  importRequest?: AbortController;
  sourceFormat: TextFormat;
}
const states = new WeakMap<HTMLElement, PropertyState>();
export function mountProperties(editor: EditorExtension): void {
  const { root } = editor,
    doc = root.ownerDocument,
    options = editor.getOptions();
  const enabled = (feature: string) =>
    options.features?.[
      feature as keyof NonNullable<typeof options.features>
    ] !== false;
  const locked = !!options.readOnly || !!options.disabled;
  const state = states.get(root) ?? {
    stops: [
      { color: "#ffaa00", position: 0 },
      { color: "#ff5555", position: 1 },
    ],
    sourceFormat: "minimessage",
  };
  states.set(root, state);
  let alive = true;
  editor.onDispose(() => {
    alive = false;
    state.importRequest?.abort();
  });
  const panel = element(doc, "div", "mce-properties");
  root.append(panel);
  const label = (key: string, fallback: string) =>
    options.labels?.[key] ?? fallback;
  const heading = (title: string) =>
    panel.append(element(doc, "h3", "mce-heading", title));
  const field = (name: string, input: HTMLElement) => {
    const wrapper = element(doc, "label", "mce-property", name);
    input.setAttribute("aria-label", name);
    wrapper.append(input);
    panel.append(wrapper);
  };
  const select = (
    name: string,
    items: [string, string][],
    current: string,
    change: (v: string) => void,
  ) => {
    const s = element(doc, "select", "");
    for (const [v, text] of items) {
      const o = element(doc, "option", "", text);
      o.value = v;
      s.append(o);
    }
    s.value = current;
    s.disabled = locked;
    s.addEventListener("change", () => change(s.value));
    field(name, s);
    return s;
  };
  const button = (
    parent: HTMLElement,
    name: string,
    action: () => void,
    disabled = locked,
  ) => {
    const b = element(doc, "button", "mce-button", name);
    b.type = "button";
    b.disabled = disabled;
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("click", action);
    parent.append(b);
    return b;
  };
  if (enabled("export")) {
    heading(label("export", "Export"));
    const output = element(doc, "textarea", "mce-export");
    output.readOnly = true;
    output.rows = 3;
    output.setAttribute("aria-label", label("exportOutput", "Export output"));
    const formats: [string, string][] = [
      ["minimessage", "MiniMessage"],
      ["legacy-ampersand", "Legacy &"],
      ["legacy-section", "Legacy §"],
      ["properties", "server.properties"],
      ["json", "JSON components"],
    ];
    const render = () => {
      const result = serializeText(editor.getDocument().motd.text, {
        format: state.sourceFormat,
        rgb: !["properties", "legacy-section"].includes(state.sourceFormat),
      });
      output.value =
        result.value ?? result.diagnostics.map((d) => d.message).join("\n");
    };
    select(
      label("exportFormat", "Export format"),
      formats,
      state.sourceFormat,
      (v) => {
        state.sourceFormat = v as TextFormat;
        render();
      },
    ).disabled = false;
    panel.append(output);
    render();
    button(
      panel,
      label("copy", "Copy output"),
      async () => {
        try {
          await navigator.clipboard.writeText(output.value);
        } catch {
          output.focus();
          output.select();
        }
      },
      false,
    );
    const observer = new MutationObserver(render);
    const source = root.querySelector(".ProseMirror");
    if (source)
      observer.observe(source, {
        subtree: true,
        characterData: true,
        childList: true,
      });
    editor.onDispose(() => observer.disconnect());
  }
  if (enabled("import") && options.imports) {
    heading(label("import", "Import from server"));
    const input = element(doc, "input", "");
    input.type = "text";
    input.placeholder = "play.example.net";
    input.disabled = locked;
    field(label("serverAddress", "Server address"), input);
    const status = element(doc, "div", "mce-property-status");
    status.role = "status";
    panel.append(status);
    button(panel, label("importServer", "Import server"), async () => {
      state.importRequest?.abort();
      const controller = new AbortController();
      state.importRequest = controller;
      const before = JSON.stringify(editor.getDocument());
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error("Import timed out"));
          }, options.imports!.timeoutMs ?? 10000);
          controller.signal.addEventListener(
            "abort",
            () => reject(new Error("Import cancelled")),
            { once: true },
          );
        });
        const result = importStatus(
          await Promise.race([
            options.imports!.adapter(input.value.trim(), controller.signal),
            timeout,
          ]),
        );
        if (
          !alive ||
          controller.signal.aborted ||
          before !== JSON.stringify(editor.getDocument())
        )
          return;
        if (!result.value) {
          status.textContent = result.diagnostics
            .map((d) => d.message)
            .join("\n");
          return;
        }
        editor.execute({
          type: "replace-document",
          document: result.value,
          origin: "import",
        });
      } catch (error) {
        if (alive)
          status.textContent =
            error instanceof Error ? error.message : "Import failed";
      } finally {
        clearTimeout(timer);
      }
    });
    button(panel, label("cancelImport", "Cancel import"), () =>
      state.importRequest?.abort(),
    );
  }
}
