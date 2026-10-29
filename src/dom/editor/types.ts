import type {
  PreviewContext,
  ServerListDocument,
  TextFormat,
  TextStyle,
  SpriteCatalogEntry,
  VariableCatalogEntry,
  VariableField,
} from "../../core/model.js";
export type EditableField = VariableField;
export type Feature =
  | "motd"
  | "version"
  | "icon"
  | "players"
  | "hover"
  | "import"
  | "export"
  | "assistance"
  | "sprites"
  | "variables";
export interface EditorChange {
  origin: "visual" | "source" | "import" | "history";
  changedFields: (keyof Pick<
    ServerListDocument,
    "motd" | "version" | "icon" | "players" | "hover"
  >)[];
}
export interface ImportAdapter {
  (
    address: string,
    signal: AbortSignal,
  ): Promise<import("../../core/model.js").JavaStatus>;
}
export interface EditorOptions {
  document: ServerListDocument;
  context: PreviewContext;
  onChange(document: ServerListDocument, change: EditorChange): void;
  /** Enrich the next document atomically, e.g. application-specific intent in extensions. */
  mapChange?(
    document: ServerListDocument,
    change: EditorChange,
  ): ServerListDocument;
  features?: Partial<Record<Feature, boolean>>;
  /** Opt-in host catalog for the native inline MOTD sprite picker. */
  spriteCatalog?: readonly SpriteCatalogEntry[];
  /** Omitted discovers preview values; an explicit catalog controls discovery. */
  variableCatalog?: readonly VariableCatalogEntry[];
  labels?: Readonly<Record<string, string>>;
  /** Fixed above the entry by default; selection places tools beside selected text. */
  toolbar?: "fixed" | "selection";
  readOnly?: boolean;
  disabled?: boolean;
  imports?: { adapter: ImportAdapter; timeoutMs?: number };
}
export type EditorCommand =
  | { type: "format"; style: TextStyle; field?: EditableField }
  | {
      type: "clear-format";
      styles: readonly (keyof TextStyle)[];
      field?: EditableField;
    }
  | {
      type: "gradient";
      stops: import("../../core/model.js").GradientStop[];
      field?: EditableField;
    }
  | {
      type: "align";
      line: number;
      align: import("../../core/model.js").Alignment;
    }
  | { type: "set-field"; field: Feature; value: unknown }
  | {
      type: "replace-source";
      source: string;
      format?: TextFormat;
      field?: EditableField;
    }
  | {
      type: "replace-document";
      document: ServerListDocument;
      origin?: "import";
    }
  | { type: "undo" | "redo" };
export interface EditorHandle {
  update(options: EditorOptions): void;
  getDocument(): ServerListDocument;
  execute(command: EditorCommand): void;
  focus(field: EditableField): void;
  destroy(): void;
}
export interface EditorExtension {
  root: HTMLElement;
  getOptions(): EditorOptions;
  getDocument(): ServerListDocument;
  execute(command: EditorCommand): void;
  onDispose(callback: () => void): void;
}
export type EditorExtensionFactory = (editor: EditorExtension) => void;
