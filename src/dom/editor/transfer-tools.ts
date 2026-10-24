import {
  setLabelText,
  setLabelAttribute,
  type LabelText,
} from "../localization.js";
import type {
  ServerListDocument,
  TextDocument,
  TextFormat,
} from "../../core/model.js";
import { parseText } from "../../core/text/parse.js";
import { serializeText } from "../../core/text/serialize.js";
import { importStatus } from "../../core/status/import.js";
import { element } from "../render.js";
import {
  fieldEditable,
  toolButton,
  toolField,
  toolLabel,
  toolLocked,
  type EntryToolAction,
} from "./ui.js";
import type { EditableField, ImportAdapter } from "./types.js";
import type { ToolMount, ToolHandle } from "./tool-types.js";

const formats: [TextFormat, string][] = [
  ["minimessage", "MiniMessage"],
  ["legacy-ampersand", "Legacy &"],
  ["legacy-section", "Legacy §"],
  ["properties", "server.properties"],
  ["json", "JSON components"],
];
type Kind = "source" | "import" | "export";
interface TransferState {
  kind: Kind;
  body: HTMLElement;
  status: HTMLElement;
  footer: HTMLElement;
  apply?: HTMLButtonElement;
  invalidated: boolean;
  baseline: string;
  abort?: AbortController;
  refresh?: () => void;
  sourceFields?: EditableField[];
  adapter?: ImportAdapter;
}
interface SourceDraft {
  source: string;
  format: TextFormat;
  text: TextDocument | null;
  error: LabelText;
  dirty: boolean;
}

export function mountTransferTools(mount: ToolMount): ToolHandle {
  const { root, controller, overlays } = mount,
    doc = root.ownerDocument;
  let destroyed = false,
    active: TransferState | null = null;
  const label = (key: string, fallback: string) =>
    toolLabel(mount, key, fallback);
  const formatItems = (): [string, LabelText][] =>
    formats.map(([value, caption]) => [
      value,
      label("format." + value, caption),
    ]);
  const textFor = (field: EditableField): TextDocument | null => {
    const current = controller.getDocument();
    return field === "motd"
      ? current.motd.text
      : field === "version"
        ? current.version.mode !== "automatic"
          ? current.version.text
          : null
        : current.hover.mode === "custom"
          ? current.hover.text
          : null;
  };
  const fields = (editable: boolean) =>
    (["motd", "version", "hover"] as const).filter(
      (field) => !!textFor(field) && (!editable || fieldEditable(mount, field)),
    );
  const allowed = (kind: Kind) =>
    kind === "export"
      ? controller.getOptions().features?.export !== false
      : !toolLocked(mount) &&
        (kind === "source"
          ? !!fields(true).length
          : controller.getOptions().features?.import !== false &&
            !!controller.getOptions().imports);
  const fieldName = (field: EditableField) =>
    label(
      field + "Source",
      field === "motd"
        ? "MOTD source"
        : field === "version"
          ? "Version source"
          : "Hover source",
    );
  function select(
    name: LabelText,
    items: [string, LabelText][],
    value: string,
    onChange: (value: string) => void,
  ) {
    const input = element(doc, "select", "");
    for (const [value, text] of items) {
      const option = element(doc, "option", "", text);
      option.value = value;
      input.append(option);
    }
    input.value = value;
    input.addEventListener("change", () => onChange(input.value));
    return { input, field: toolField(doc, name, input) };
  }
  function begin(kind: Kind, title: LabelText): TransferState | null {
    if (destroyed || !allowed(kind)) return null;
    overlays.close("dismiss");
    const body = element(doc, "div", "mce-tool-content"),
      heading = element(doc, "div", "mce-tool-heading"),
      status = element(doc, "div", "mce-tool-status"),
      footer = element(doc, "div", "mce-tool-footer");
    heading.append(element(doc, "strong", "", title));
    status.role = "status";
    body.append(heading);
    const state: TransferState = {
      kind,
      body,
      status,
      footer,
      baseline: JSON.stringify(controller.getDocument()),
      invalidated: false,
    };
    active = state;
    return state;
  }
  function show(state: TransferState, title: LabelText) {
    const cancel = toolButton(
      doc,
      label(
        state.kind === "export" ? "close" : "cancel",
        state.kind === "export" ? "Close" : "Cancel",
      ),
      label(
        state.kind === "export" ? "close" : "cancel",
        state.kind === "export" ? "Close" : "Cancel",
      ),
      () => overlays.close("cancel"),
    );
    cancel.dataset.cancel = "true";
    state.footer.prepend(cancel);
    state.body.append(state.status, state.footer);
    const anchor = root.querySelector<HTMLButtonElement>(
      ".mce-entry-actions button[aria-label]",
    )!;
    // The menu trigger is stable even when its temporary item has been removed.
    const trigger =
      root.querySelector<HTMLButtonElement>("[data-entry-menu]") ?? anchor;
    overlays.open({
      id: "transfer:" + state.kind,
      label: title,
      anchor: trigger,
      content: state.body,
      mode: "dialog",
      onClose: () => {
        state.abort?.abort();
        if (active === state) active = null;
      },
    });
  }
  function invalidate(state: TransferState) {
    if (state.invalidated) return;
    state.invalidated = true;
    state.abort?.abort();
    setLabelText(
      state.status,
      label(
        "draftInvalidated",
        "The document or editor configuration changed. This draft can no longer be applied. Close and reopen the tool.",
      ),
    );
    for (const control of state.body.querySelectorAll<
      | HTMLInputElement
      | HTMLButtonElement
      | HTMLSelectElement
      | HTMLTextAreaElement
    >("input,button,select,textarea"))
      if (control.dataset.cancel !== "true") control.disabled = true;
  }
  function openSource() {
    const title = label("sourceEditor", "Source editor"),
      state = begin("source", title);
    if (!state) return;
    const available = fields(true),
      drafts = new Map<EditableField, SourceDraft>();
    state.sourceFields = available;
    for (const field of available) {
      const text = textFor(field)!,
        format = text.source?.format ?? "minimessage",
        serialized = serializeText(text, {
          format,
          rgb: !["properties", "legacy-section"].includes(format),
        });
      drafts.set(field, {
        source: serialized.value ?? text.source?.value ?? "",
        format,
        text: serialized.value !== null ? text : null,
        error: mount.localization.diagnostics(serialized.diagnostics),
        dirty: false,
      });
    }
    let field = available[0]!;
    const source = element(doc, "textarea", "mce-tool-source");
    source.rows = 8;
    source.spellcheck = false;
    const chooseField = select(
      label("sourceField", "Source field"),
      available.map((field) => [field, fieldName(field)]),
      field,
      (value) => {
        field = value as EditableField;
        render();
      },
    );
    const chooseFormat = select(
      label("sourceFormat", "Source format"),
      formatItems(),
      drafts.get(field)!.format,
      (value) => {
        const draft = drafts.get(field)!;
        if (!draft.text) {
          chooseFormat.input.value = draft.format;
          setLabelText(state.status, draft.error);
          return;
        }
        const format = value as TextFormat,
          result = serializeText(draft.text, {
            format,
            rgb: !["properties", "legacy-section"].includes(format),
          });
        if (result.value === null) {
          chooseFormat.input.value = draft.format;
          setLabelText(
            state.status,
            mount.localization.diagnostics(result.diagnostics),
          );
          return;
        }
        draft.source = result.value;
        draft.format = format;
        draft.text = parseText(result.value, format).value;
        draft.dirty = true;
        draft.error = mount.localization.diagnostics(result.diagnostics);
        render();
      },
    );
    source.addEventListener("input", () => {
      if (state.invalidated) return;
      const draft = drafts.get(field)!,
        result = parseText(source.value, draft.format);
      draft.source = source.value;
      draft.text = result.value;
      draft.error = mount.localization.diagnostics(result.diagnostics);
      draft.dirty = true;
      validate();
    });
    state.apply = toolButton(
      doc,
      label("apply", "Apply"),
      label("apply", "Apply"),
      () => {
        if (state.invalidated || !allowed("source")) return;
        const changed = [...drafts].filter(([, draft]) => draft.dirty);
        if (!changed.length || changed.some(([, draft]) => !draft.text)) return;
        const sources = changed.map(([field, draft]) => ({
          field,
          source: draft.source,
          format: draft.format,
        }));
        overlays.close("apply");
        controller.applySources(sources);
      },
    );
    const validate = () => {
      setLabelText(state.status, drafts.get(field)!.error);
      state.apply!.disabled =
        state.invalidated ||
        ![...drafts.values()].some((draft) => draft.dirty) ||
        [...drafts.values()].some((draft) => draft.dirty && !draft.text);
    };
    const render = () => {
      const draft = drafts.get(field)!;
      chooseFormat.input.value = draft.format;
      source.value = draft.source;
      setLabelAttribute(source, "aria-label", fieldName(field));
      validate();
    };
    state.body.append(chooseField.field, chooseFormat.field, source);
    state.footer.append(state.apply);
    render();
    show(state, title);
  }
  function openExport() {
    const title = label("export", "Export"),
      state = begin("export", title);
    if (!state) return;
    let field: EditableField = "motd",
      format: TextFormat = "minimessage",
      outputValue: string | null = null;
    const output = element(doc, "textarea", "mce-tool-source");
    output.rows = 7;
    output.readOnly = true;
    setLabelAttribute(
      output,
      "aria-label",
      label("exportOutput", "Export output"),
    );
    const chooseField = select(
      label("exportField", "Export field"),
      fields(false).map((field) => [field, fieldName(field)]),
      field,
      (value) => {
        field = value as EditableField;
        render();
      },
    );
    const chooseFormat = select(
      label("exportFormat", "Export format"),
      formatItems(),
      format,
      (value) => {
        format = value as TextFormat;
        render();
      },
    );
    const copy = toolButton(
      doc,
      label("copy", "Copy output"),
      label("copy", "Copy output"),
      async () => {
        if (outputValue === null) return;
        try {
          await doc.defaultView!.navigator.clipboard.writeText(outputValue);
        } catch {
          if (active === state) {
            output.focus();
            output.select();
            setLabelText(
              state.status,
              label(
                "copyFallback",
                "Copy the selected output using your browser.",
              ),
            );
          }
        }
      },
    );
    const render = () => {
      const text = textFor(field);
      if (!text) {
        field = "motd";
        chooseField.input.value = field;
      }
      const result = serializeText(textFor(field)!, {
        format,
        rgb: !["properties", "legacy-section"].includes(format),
      });
      outputValue = result.value;
      output.value = result.value ?? "";
      copy.disabled = result.value === null;
      setLabelText(
        state.status,
        mount.localization.diagnostics(result.diagnostics),
      );
    };
    state.refresh = render;
    state.body.append(chooseField.field, chooseFormat.field, output);
    state.footer.append(copy);
    render();
    show(state, title);
  }
  function openImport() {
    const title = label("importStatus", "Import server status"),
      state = begin("import", title);
    if (!state) return;
    const imports = controller.getOptions().imports!,
      address = element(doc, "input", ""),
      result = element(doc, "textarea", "mce-tool-source");
    address.type = "text";
    setLabelAttribute(address, "placeholder", "play.example.net");
    result.rows = 6;
    result.readOnly = true;
    result.hidden = true;
    setLabelAttribute(
      result,
      "aria-label",
      label("importPreview", "Imported server status"),
    );
    state.adapter = imports.adapter;
    let staged: ServerListDocument | null = null;
    state.apply = toolButton(
      doc,
      label("apply", "Apply"),
      label("apply", "Apply"),
      () => {
        if (state.invalidated || !allowed("import") || !staged) return;
        const document = staged;
        overlays.close("apply");
        controller.execute({
          type: "replace-document",
          document,
          origin: "import",
        });
      },
    );
    state.apply.disabled = true;
    const fetch = toolButton(
      doc,
      label("importServer", "Import server"),
      label("importServer", "Import server"),
      async () => {
        if (state.invalidated || !allowed("import") || !address.value.trim())
          return;
        state.abort?.abort();
        const request = new AbortController();
        state.abort = request;
        staged = null;
        state.apply!.disabled = true;
        result.hidden = true;
        setLabelText(
          state.status,
          label("importLoading", "Loading server status…"),
        );
        let timer: ReturnType<typeof setTimeout> | undefined;
        const valid = () =>
          !destroyed &&
          active === state &&
          !state.invalidated &&
          state.abort === request &&
          !request.signal.aborted &&
          allowed("import") &&
          imports.adapter === controller.getOptions().imports?.adapter;
        try {
          const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error("Import timed out"));
              request.abort();
            }, imports.timeoutMs ?? 10000);
            request.signal.addEventListener(
              "abort",
              () => reject(new Error("Import cancelled")),
              { once: true },
            );
          });
          const imported = importStatus(
            await Promise.race([
              Promise.resolve().then(() =>
                imports.adapter(address.value.trim(), request.signal),
              ),
              timeout,
            ]),
          );
          if (!valid()) return;
          if (state.baseline !== JSON.stringify(controller.getDocument())) {
            invalidate(state);
            return;
          }
          staged = imported.value;
          setLabelText(
            state.status,
            mount.localization.diagnostics(imported.diagnostics),
          );
          if (staged) {
            result.hidden = false;
            result.value = JSON.stringify(staged, null, 2);
            setLabelText(
              state.status,
              label(
                "importReady",
                "Review the imported status, then Apply. Disabled fields will be kept.",
              ),
            );
            state.apply!.disabled = false;
          }
        } catch (error) {
          // Timeout aborts transport too; its error must still be visible for this request.
          if (
            !destroyed &&
            active === state &&
            !state.invalidated &&
            state.abort === request
          )
            setLabelText(
              state.status,
              error instanceof Error && error.message.trim()
                ? error.message
                : label("importFailed", "Import failed"),
            );
        } finally {
          clearTimeout(timer);
        }
      },
    );
    state.body.append(
      toolField(doc, label("serverAddress", "Server address"), address),
      fetch,
      result,
    );
    state.footer.append(state.apply);
    show(state, title);
  }
  const menu = (event: Event) => {
    const items = (event as CustomEvent<EntryToolAction[]>).detail;
    items.push({
      label: label("source", "Source"),
      enabled: allowed("source"),
      action: openSource,
    });
    if (controller.getOptions().imports)
      items.push({
        label: label("import", "Import"),
        enabled: allowed("import"),
        action: openImport,
      });
    items.push({
      label: label("export", "Export"),
      enabled: allowed("export"),
      action: openExport,
    });
  };
  root.addEventListener("mce-entry-menu", menu);
  function update() {
    if (!active || destroyed) return;
    if (
      !allowed(active.kind) ||
      (active.kind === "source" &&
        active.sourceFields?.some((field) => !fieldEditable(mount, field)))
    )
      overlays.close("cancel");
    else if (
      active.kind === "import" &&
      active.adapter !== controller.getOptions().imports?.adapter
    )
      invalidate(active);
    else if (active.kind === "export") active.refresh?.();
  }
  const unsubscribe = controller.subscribe((event) => {
    if (
      active &&
      active.kind !== "export" &&
      (event === "replace" || event === "document") &&
      active.baseline !== JSON.stringify(controller.getDocument())
    )
      invalidate(active);
    if (event !== "selection") update();
  });
  return {
    update,
    destroy() {
      destroyed = true;
      unsubscribe();
      root.removeEventListener("mce-entry-menu", menu);
      if (overlays.getOpenId()?.startsWith("transfer:"))
        overlays.close("destroy");
      active?.abort?.abort();
      active = null;
    },
  };
}
