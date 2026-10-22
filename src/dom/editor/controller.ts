import {
  EditorState,
  Plugin,
  TextSelection,
  Selection,
} from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import type {
  Diagnostic,
  ServerListDocument,
  TextDocument,
  TextFormat,
} from "../../core/model.js";
import { evaluatePlayerCounts } from "../../core/status/evaluate.js";
import { validateDocument } from "../../core/document.js";
import { parseText } from "../../core/text/parse.js";
import { editorSchema, type StylePath } from "./schema.js";
import { fromEditorNode, nextId, toEditorNode } from "./mapping.js";
import { EditorHistory, type HistoryEntry } from "./history.js";
import { inlineEffects } from "./effects.js";
import { inlineAlignment } from "./alignment.js";
import { entryTextWidth } from "../render.js";
import type {
  EditableField,
  Feature,
  EditorOptions,
  EditorHandle,
  EditorCommand,
  EditorChange,
} from "./types.js";

export interface FieldSelection {
  field: EditableField;
  from: number;
  to: number;
  generation: number;
}
export type EditorEvent =
  | "document"
  | "options"
  | "selection"
  | "composition"
  | "replace"
  | "diagnostics";
export interface EditorController extends EditorHandle {
  getOptions(): EditorOptions;
  getGeneration(): number;
  getActiveField(): EditableField;
  getView(field: EditableField): EditorView | undefined;
  getDiagnostics(): readonly Diagnostic[];
  isComposing(): boolean;
  mountText(field: EditableField, host: HTMLElement): void;
  captureSelection(): FieldSelection | null;
  restoreSelection(selection: FieldSelection): boolean;
  insertPlaceholder(name: string, selection: FieldSelection): void;
  applySources(
    sources: { field: EditableField; source: string; format: TextFormat }[],
  ): void;
  subscribe(listener: (event: EditorEvent) => void): () => void;
}
export function createEditorController(
  initial: EditorOptions,
): EditorController {
  const snapshotOptions = (next: EditorOptions): EditorOptions => ({
    ...next,
    context: {
      ...next.context,
      base: structuredClone(next.context.base),
      values: { ...next.context.values },
    },
    features: { ...next.features },
    labels: { ...next.labels },
  });
  let options = snapshotOptions(initial),
    current = structuredClone(initial.document),
    destroyed = false,
    generation = 0;
  let activeField: EditableField = "motd",
    errors: string[] = [],
    pending = false,
    pendingReplacement = false;
  const history = new EditorHistory(),
    views = new Map<EditableField, EditorView>();
  const listeners = new Set<(event: EditorEvent) => void>(),
    composing = new Set<EditableField>(),
    selections = new Set<FieldSelection>();
  const textSnapshots = new Map<EditableField, string>(),
    valueSnapshots = new Map<EditableField, string>();
  const viewGenerations = new Map<EditableField, number>(),
    rejectedCompositions = new Set<EditableField>();
  const label = (key: string, fallback: string) =>
    options.labels?.[key] ?? fallback;
  const enabled = (field: Feature) => options.features?.[field] !== false;
  const locked = () => !!options.readOnly || !!options.disabled;
  const emit = (event: EditorEvent) => {
    if (!destroyed) for (const listener of [...listeners]) listener(event);
  };
  const textFor = (field: EditableField): TextDocument =>
    field === "motd"
      ? current.motd.text
      : field === "version" && current.version.mode !== "automatic"
        ? current.version.text
        : field === "hover" && current.hover.mode === "custom"
          ? current.hover.text
          : { revision: 0, nodes: [] };
  const setText = (
    state: ServerListDocument,
    field: EditableField,
    text: TextDocument,
  ) => {
    if (field === "motd") state.motd.text = text;
    else if (field === "version")
      state.version = {
        mode:
          state.version.mode === "automatic" ? "always" : state.version.mode,
        text,
      };
    else state.hover = { mode: "custom", text };
  };
  const snapshot = (): HistoryEntry => {
    const v = views.get(activeField);
    return {
      document: structuredClone(current),
      ...(v
        ? {
            selection: {
              field: activeField,
              from: v.state.selection.from,
              to: v.state.selection.to,
            },
          }
        : {}),
    };
  };

  function showErrors() {
    emit("diagnostics");
  }
  const values = () => {
    const counts = evaluatePlayerCounts(current, options.context).value;
    return {
      ...options.context.values,
      ...(counts?.online !== undefined
        ? { players: String(counts.online) }
        : {}),
      ...(counts?.max !== undefined ? { max: String(counts.max) } : {}),
    };
  };
  function plugins(
    field: EditableField,
    resolved: Readonly<Record<string, string>>,
  ) {
    return [
      inlineEffects(() => textFor(field), resolved),
      ...(field === "motd"
        ? [
            inlineAlignment(
              () => textFor(field),
              resolved,
              () => ({
                profile: options.context.profile,
                width: entryTextWidth(options.context),
                maxLines: 2,
                alignments: current.motd.alignments,
              }),
            ),
          ]
        : []),
      new Plugin({
        filterTransaction(tr, state) {
          return (
            !tr.docChanged ||
            field !== "motd" ||
            tr.doc.childCount <= Math.max(2, state.doc.childCount)
          );
        },
      }),
      keymap({
        "Mod-z": () => {
          execute({ type: "undo" });
          return true;
        },
        "Mod-y": () => {
          execute({ type: "redo" });
          return true;
        },
        "Mod-Shift-z": () => {
          execute({ type: "redo" });
          return true;
        },
      }),
      keymap(baseKeymap),
    ];
  }
  function refreshViews(selection?: HistoryEntry["selection"]) {
    if (composing.size) {
      for (const field of composing)
        if (textSnapshots.get(field) !== JSON.stringify(textFor(field)))
          rejectedCompositions.add(field);
      pending = true;
      return;
    }
    for (const [field, view] of views) {
      const resolved = values();
      const textSnapshot = JSON.stringify(textFor(field)),
        valueSnapshot = JSON.stringify(resolved);
      if (
        textSnapshots.get(field) !== textSnapshot ||
        valueSnapshots.get(field) !== valueSnapshot
      ) {
        if (textSnapshots.get(field) !== textSnapshot) {
          for (const saved of selections)
            if (saved.field === field) selections.delete(saved);
        }
        const schema = editorSchema(view.dom.ownerDocument, resolved),
          node = toEditorNode(textFor(field), schema);
        let nextSelection;
        try {
          nextSelection = Selection.fromJSON(
            node,
            view.state.selection.toJSON(),
          );
        } catch {
          nextSelection = TextSelection.atStart(node);
        }
        if (selection?.field === field)
          nextSelection = TextSelection.create(
            node,
            Math.max(1, Math.min(selection.from, node.content.size - 1)),
            Math.max(1, Math.min(selection.to, node.content.size - 1)),
          );
        const marks = view.state.storedMarks?.map((mark) =>
          schema.marks[mark.type.name]!.create(mark.attrs),
        );
        view.updateState(
          EditorState.create({
            schema,
            doc: node,
            selection: nextSelection,
            storedMarks: marks,
            plugins: plugins(field, resolved),
          }),
        );
        textSnapshots.set(field, textSnapshot);
        valueSnapshots.set(field, valueSnapshot);
      } else if (selection?.field === field) {
        view.dispatch(
          view.state.tr.setSelection(
            TextSelection.create(
              view.state.doc,
              Math.max(
                1,
                Math.min(selection.from, view.state.doc.content.size - 1),
              ),
              Math.max(
                1,
                Math.min(selection.to, view.state.doc.content.size - 1),
              ),
            ),
          ),
        );
      }
      view.setProps({
        editable: () => !locked() && enabled(field),
        attributes: {
          "aria-label": label(
            field,
            field === "motd"
              ? "MOTD inline editor"
              : field === "version"
                ? "Version inline editor"
                : "Hover inline editor",
          ),
          role: "textbox",
          "aria-multiline": String(field !== "version"),
        },
      });
      viewGenerations.set(field, generation);
      rejectedCompositions.delete(field);
    }
    if (selection) views.get(selection.field as EditableField)?.focus();
  }
  function rebuild(selection?: HistoryEntry["selection"]) {
    refreshViews(selection);
    emit("document");
  }
  function mountText(field: EditableField, host: HTMLElement) {
    if (destroyed) return;
    const existing = views.get(field);
    if (existing) {
      if (existing.dom.parentElement !== host && !composing.has(field))
        host.append(existing.dom);
      return;
    }
    host.dataset.editorField = field;
    host.classList.add("mce-inline");
    const resolved = values(),
      schema = editorSchema(host.ownerDocument, resolved);
    const view = new EditorView(host, {
      state: EditorState.create({
        schema,
        doc: toEditorNode(textFor(field), schema),
        plugins: plugins(field, resolved),
      }),
      editable: () => !locked() && enabled(field),
      attributes: {
        "aria-label": label(
          field,
          field === "motd"
            ? "MOTD inline editor"
            : field === "version"
              ? "Version inline editor"
              : "Hover inline editor",
        ),
        role: "textbox",
        "aria-multiline": String(field !== "version"),
      },
      handleDOMEvents: {
        focus() {
          activeField = field;
          emit("selection");
          return false;
        },
        compositionstart() {
          composing.add(field);
          emit("composition");
          return false;
        },
        compositionend() {
          composing.delete(field);
          queueMicrotask(() => {
            if (destroyed) return;
            if (pending && !composing.size) {
              pending = false;
              const replaced = pendingReplacement;
              pendingReplacement = false;
              refreshViews();
              emit(replaced ? "replace" : "options");
            }
            emit("composition");
          });
          return false;
        },
      },
      handlePaste(view, event) {
        const plain = event.clipboardData?.getData("text/plain");
        if (plain !== undefined) {
          view.dispatch(view.state.tr.insertText(plain));
          return true;
        }
        return false;
      },
      dispatchTransaction(tr) {
        if (destroyed) return;
        const before = snapshot();
        view.updateState(view.state.apply(tr));
        if (
          tr.docChanged &&
          (locked() ||
            !enabled(field) ||
            viewGenerations.get(field) !== generation ||
            rejectedCompositions.has(field))
        ) {
          // Keep native composition alive, but never serialize rejected text into
          // the committed document. Rebuild from that document once it finishes.
          textSnapshots.delete(field);
          rejectedCompositions.add(field);
          refreshViews();
          return;
        }
        for (const saved of selections)
          if (saved.field === field) {
            saved.from = tr.mapping.map(saved.from, 1);
            saved.to = tr.mapping.map(saved.to, -1);
          }
        if (tr.docChanged && !locked() && enabled(field)) {
          const next = structuredClone(current);
          setText(next, field, fromEditorNode(view.state.doc, textFor(field)));
          const nextText =
            field === "motd"
              ? next.motd.text
              : field === "version" && next.version.mode !== "automatic"
                ? next.version.text
                : next.hover.mode === "custom"
                  ? next.hover.text
                  : textFor(field);
          textSnapshots.set(field, JSON.stringify(nextText));
          if (commit(next, "visual", field, !tr.storedMarksSet, before))
            emit("document");
        }
        if (tr.selectionSet || tr.storedMarksSet) emit("selection");
      },
    });
    views.set(field, view);
    viewGenerations.set(field, generation);
    textSnapshots.set(field, JSON.stringify(textFor(field)));
    valueSnapshots.set(field, JSON.stringify(resolved));
  }
  function commit(
    next: ServerListDocument,
    origin: EditorChange["origin"],
    field: Feature,
    typing = false,
    before?: HistoryEntry,
    changedFields?: EditorChange["changedFields"],
  ): boolean {
    const change: EditorChange = {
      origin,
      changedFields: changedFields ?? [
        field as EditorChange["changedFields"][number],
      ],
    };
    const mapped = options.mapChange
      ? options.mapChange(structuredClone(next), change)
      : next;
    const valid = validateDocument(mapped);
    if (!valid.value) {
      errors = valid.diagnostics.map((d) => d.message);
      showErrors();
      return false;
    }
    history.record(before ?? snapshot(), typing);
    current = valid.value;
    errors = [];
    showErrors();
    options.onChange(structuredClone(current), {
      origin,
      changedFields: changedFields ?? [
        field as EditorChange["changedFields"][number],
      ],
    });
    return true;
  }
  function execute(command: EditorCommand): void {
    if (destroyed || locked()) return;
    if (command.type === "replace-document") {
      if (command.origin === "import" && !enabled("import")) return;
      const next = structuredClone(command.document);
      for (const field of [
        "motd",
        "version",
        "icon",
        "players",
        "hover",
      ] as const)
        if (!enabled(field)) Object.assign(next, { [field]: current[field] });
      const changedFields = (
        ["motd", "version", "icon", "players", "hover"] as const
      ).filter(
        (field) =>
          JSON.stringify(next[field]) !== JSON.stringify(current[field]),
      );
      if (
        changedFields.length &&
        commit(
          next,
          command.origin ?? "visual",
          changedFields[0]!,
          false,
          undefined,
          command.origin === "import"
            ? (["motd", "version", "icon", "players", "hover"] as const).filter(
                (field) => enabled(field),
              )
            : changedFields,
        )
      )
        rebuild();
      return;
    }
    if (command.type === "undo" || command.type === "redo") {
      const entry =
        command.type === "undo"
          ? history.undo(snapshot())
          : history.redo(snapshot());
      if (entry) {
        const restored = structuredClone(entry.document);
        for (const field of [
          "motd",
          "version",
          "icon",
          "players",
          "hover",
        ] as const)
          if (!enabled(field))
            Object.assign(restored, { [field]: current[field] });
        const changedFields = (
          ["motd", "version", "icon", "players", "hover"] as const
        ).filter(
          (field) =>
            JSON.stringify(restored[field]) !== JSON.stringify(current[field]),
        );
        current = restored;
        rebuild(entry.selection);
        options.onChange(structuredClone(current), {
          origin: "history",
          changedFields,
        });
      }
      return;
    }
    const field =
      command.type === "align"
        ? "motd"
        : "field" in command
          ? (command.field ?? activeField)
          : activeField;
    if (!enabled(field as Feature)) return;
    if (command.type === "format" || command.type === "gradient") {
      const v = views.get(field as EditableField);
      if (!v) return;
      const { from, to } = v.state.selection;
      const style =
          command.type === "gradient"
            ? { gradient: command.stops }
            : command.style,
        tr = v.state.tr,
        id = nextId();
      const mark = (path: StylePath[], leafId?: string) =>
        v.state.schema.marks.format!.create({
          path:
            command.type === "gradient" ||
            ("rainbow" in style && !!style.rainbow)
              ? [
                  { id, style },
                  ...path.map((p) => {
                    const { color, gradient, gradientPhase, rainbow, ...rest } =
                      p.style;
                    return { ...p, style: rest };
                  }),
                ]
              : [...path, { id, style }],
          leafId,
        });
      if (from === to) {
        const existing = v.state.storedMarks ?? v.state.selection.$from.marks(),
          old = existing.find((m) => m.type.name === "format");
        tr.setStoredMarks([mark(old?.attrs.path ?? [], old?.attrs.leafId)]);
        v.dispatch(tr);
        v.focus();
        return;
      }
      v.state.doc.nodesBetween(from, to, (node, pos) => {
        if (
          node.type.name === "token" &&
          node.attrs.node.type === "placeholder"
        ) {
          tr.setNodeMarkup(pos, undefined, {
            ...node.attrs,
            path: mark(node.attrs.path ?? []).attrs.path,
          });
          return;
        }
        if (!node.isText) return;
        const old = node.marks.find((m) => m.type.name === "format");
        tr.addMark(
          Math.max(from, pos),
          Math.min(to, pos + node.nodeSize),
          mark(old?.attrs.path ?? [], old?.attrs.leafId),
        );
      });
      v.dispatch(tr);
      v.focus();
      return;
    }
    const next = structuredClone(current);
    if (command.type === "align")
      next.motd.alignments[command.line] = command.align;
    else if (command.type === "replace-source") {
      const parsed = parseText(command.source, command.format ?? "minimessage");
      if (!parsed.value) {
        errors = parsed.diagnostics.map((d) => d.message);
        showErrors();
        return;
      }
      setText(next, field as EditableField, parsed.value);
    } else if (
      command.type === "set-field" &&
      ["motd", "version", "icon", "players", "hover"].includes(command.field)
    )
      Object.assign(next, { [command.field]: command.value });
    if (
      commit(
        next,
        command.type === "replace-source" ? "source" : "visual",
        command.type === "align" ? "motd" : (field as Feature),
      )
    )
      rebuild();
  }

  function restoreSelection(saved: FieldSelection): boolean {
    if (destroyed || saved.generation !== generation || !selections.has(saved))
      return false;
    const view = views.get(saved.field);
    if (!view || saved.from < 1 || saved.to > view.state.doc.content.size - 1)
      return false;
    activeField = saved.field;
    view.dispatch(
      view.state.tr.setSelection(
        TextSelection.create(view.state.doc, saved.from, saved.to),
      ),
    );
    return true;
  }
  return {
    execute,
    getDocument: () => structuredClone(current),
    getOptions: () => options,
    getGeneration: () => generation,
    getActiveField: () => activeField,
    getView: (field) => views.get(field),
    getDiagnostics: () =>
      errors.map((message) => ({
        code: "editor",
        severity: "error" as const,
        path: "",
        message,
      })),
    isComposing: () => composing.size > 0,
    mountText,
    applySources(sources) {
      if (destroyed || locked() || composing.size) return;
      const next = structuredClone(current);
      for (const { field, source, format } of sources) {
        if (
          !enabled(field) ||
          (field === "version" && current.version.mode === "automatic") ||
          (field === "hover" && current.hover.mode !== "custom")
        )
          return;
        const result = parseText(source, format);
        if (!result.value) {
          errors = result.diagnostics.map((d) => d.message);
          showErrors();
          return;
        }
        setText(next, field, result.value);
      }
      const changed = (["motd", "version", "hover"] as const).filter(
        (field) =>
          JSON.stringify(current[field]) !== JSON.stringify(next[field]),
      );
      if (
        changed.length &&
        commit(next, "source", changed[0]!, false, undefined, changed)
      )
        rebuild();
    },
    captureSelection() {
      const view = views.get(activeField);
      if (!view) return null;
      const native = view.dom.ownerDocument.getSelection();
      if (
        native?.anchorNode &&
        native.focusNode &&
        view.dom.contains(native.anchorNode) &&
        view.dom.contains(native.focusNode)
      ) {
        try {
          const anchor = view.posAtDOM(native.anchorNode, native.anchorOffset),
            head = view.posAtDOM(native.focusNode, native.focusOffset);
          const selection = TextSelection.between(
            view.state.doc.resolve(anchor),
            view.state.doc.resolve(head),
          );
          if (!selection.eq(view.state.selection))
            view.dispatch(view.state.tr.setSelection(selection));
        } catch {
          return null;
        }
      }
      const saved = {
        field: activeField,
        from: Math.max(1, view.state.selection.from),
        to: Math.min(view.state.doc.content.size - 1, view.state.selection.to),
        generation,
      };
      selections.add(saved);
      return saved;
    },
    restoreSelection,
    insertPlaceholder(name, saved) {
      if (
        locked() ||
        !enabled(saved.field) ||
        !name.trim() ||
        !restoreSelection(saved)
      )
        return;
      const view = views.get(saved.field)!;
      view.dispatch(
        view.state.tr.replaceSelectionWith(
          view.state.schema.nodes.token!.create({
            node: { id: nextId(), type: "placeholder", name },
            path: [],
          }),
        ),
      );
      view.focus();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    focus(field) {
      activeField = field;
      views.get(field)?.focus();
    },
    update(next) {
      if (destroyed) return;
      const changed = JSON.stringify(next.document) !== JSON.stringify(current);
      options = snapshotOptions(next);
      if (changed) {
        current = structuredClone(next.document);
        history.clear();
        generation++;
        selections.clear();
      }
      if (composing.size) {
        pending = true;
        pendingReplacement ||= changed;
        for (const field of composing)
          if (locked() || !enabled(field)) {
            rejectedCompositions.add(field);
            textSnapshots.delete(field);
          }
        return;
      }
      refreshViews();
      emit(changed ? "replace" : "options");
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const view of views.values()) view.destroy();
      views.clear();
      listeners.clear();
      selections.clear();
      composing.clear();
      viewGenerations.clear();
      rejectedCompositions.clear();
    },
  };
}
