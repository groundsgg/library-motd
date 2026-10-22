import type { GradientStop, TextFormat } from "../core/model.js";
import { serializeText } from "../core/text/serialize.js";
import { importStatus } from "../core/status/import.js";
import { element } from "./preview.js";
import { normalizeIcon } from "./icon.js";
import type { EditorExtension } from "./editor/index.js";
interface PropertyState {
  iconFile?: File;
  crop?: { x: number; y: number; size: number };
  stops: GradientStop[];
  importRequest?: AbortController;
  sourceFormat: TextFormat;
}
const states = new WeakMap<HTMLElement, PropertyState>();
export function mountProperties(editor: EditorExtension): void {
  const { root } = editor,
    doc = root.ownerDocument,
    options = editor.getOptions(),
    value = editor.getDocument();
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
  if (enabled("icon")) {
    heading(label("serverIcon", "Server icon"));
    const file = element(doc, "input", "");
    file.type = "file";
    file.accept = "image/png,image/jpeg";
    file.disabled = locked;
    field(label("serverIcon", "Server icon"), file);
    const status = element(doc, "div", "mce-property-status");
    status.role = "status";
    panel.append(status);
    file.addEventListener("change", async () => {
      const uploaded = file.files?.[0];
      if (!uploaded) return;
      const result = await normalizeIcon(uploaded);
      if (!alive) return;
      if (result.value) {
        state.iconFile = uploaded;
        const image = await createImageBitmap(uploaded);
        const size = Math.min(image.width, image.height);
        state.crop = {
          x: Math.floor((image.width - size) / 2),
          y: Math.floor((image.height - size) / 2),
          size,
        };
        image.close();
        editor.execute({
          type: "set-field",
          field: "icon",
          value: result.value,
        });
      } else
        status.textContent = result.diagnostics
          .map((d) => d.message)
          .join("\n");
    });
    if (state.iconFile && state.crop) {
      const crop = state.crop,
        cropPanel = element(doc, "details", "");
      cropPanel.append(
        element(doc, "summary", "", label("crop", "Crop image")),
      );
      panel.append(cropPanel);
      for (const key of ["x", "y", "size"] as const) {
        const i = element(doc, "input", "");
        i.type = "number";
        i.value = String(crop[key]);
        i.min = key === "size" ? "1" : "0";
        i.setAttribute("aria-label", `Crop ${key}`);
        i.disabled = locked;
        i.addEventListener("input", () => {
          crop[key] = Number(i.value);
        });
        cropPanel.append(i);
      }
      button(cropPanel, "Apply crop", async () => {
        const result = await normalizeIcon(state.iconFile!, {
          crop: { x: crop.x, y: crop.y, width: crop.size, height: crop.size },
        });
        if (!alive) return;
        if (result.value)
          editor.execute({
            type: "set-field",
            field: "icon",
            value: result.value,
          });
        else
          status.textContent = result.diagnostics
            .map((d) => d.message)
            .join("\n");
      });
    }
    if (value.icon)
      button(panel, label("resetIcon", "Reset icon"), () =>
        editor.execute({ type: "set-field", field: "icon", value: null }),
      );
    const icon = root.querySelector<HTMLElement>("[data-field=icon]");
    if (icon && !locked) {
      const upload = element(
        doc,
        "button",
        "mce-icon-upload",
        label("upload", "Upload"),
      );
      const glyph = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
      glyph.setAttribute("viewBox", "0 0 16 16");
      glyph.setAttribute("class", "mce-upload-icon");
      glyph.setAttribute("aria-hidden", "true");
      glyph.setAttribute("fill", "currentColor");
      glyph.setAttribute("shape-rendering", "crispEdges");
      for (const data of [
        "M1 3h8v1H2v10h12V8h1v7H1z",
        "M3 11h1v-1h1V9h1v1h1v1h1v1h1v-1h1v-1h1v1h1v1h1v1H3z",
        "M4 6h2v2H4z",
        "M12 1h2v2h2v2h-2v2h-2V5h-2V3h2z",
      ]) {
        const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", data);
        glyph.append(path);
      }
      upload.prepend(glyph);
      upload.type = "button";
      upload.setAttribute(
        "aria-label",
        label("uploadIcon", "Upload server icon"),
      );
      upload.title = label("uploadIcon", "Upload server icon");
      upload.addEventListener("click", () => file.click());
      icon.append(upload);
    }
  }
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
