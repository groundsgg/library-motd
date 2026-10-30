import { EditorView } from "prosemirror-view";

export interface SelectionModelState {
  from: number;
  to: number;
  anchor: number;
  head: number;
  empty: boolean;
  docSize: number;
}
export type SelectionProbeWindow = Window & {
  selectionEvents?: unknown[];
  selectionModelSnapshot?: (
    root: HTMLElement,
  ) => SelectionModelState | undefined;
  selectionModelUpdated?: (
    root: HTMLElement,
    phase: "before" | "after",
    state: SelectionModelState,
  ) => void;
  disposeSelectionModelProbe?: () => void;
};

/** Test-fixture-only observation of the actual controller-owned EditorViews. */
export function installSelectionModelProbe(): void {
  const win = window as SelectionProbeWindow;
  if (!win.selectionEvents || win.disposeSelectionModelProbe) return;
  const views = new WeakMap<HTMLElement, EditorView>();
  const snapshot = (view: EditorView): SelectionModelState => ({
    from: view.state.selection.from,
    to: view.state.selection.to,
    anchor: view.state.selection.anchor,
    head: view.state.selection.head,
    empty: view.state.selection.empty,
    docSize: view.state.doc.content.size,
  });
  const update = EditorView.prototype.updateState;
  const observe = (view: EditorView, phase: "before" | "after") => {
    try {
      win.selectionModelUpdated?.(view.dom, phase, snapshot(view));
    } catch {
      /* Diagnostics never change editor outcomes. */
    }
  };
  EditorView.prototype.updateState = function (state) {
    views.set(this.dom, this);
    observe(this, "before");
    const result = update.call(this, state);
    observe(this, "after");
    return result;
  };
  win.selectionModelSnapshot = (root) => {
    const view = views.get(root);
    return view ? snapshot(view) : undefined;
  };
  win.disposeSelectionModelProbe = () => {
    EditorView.prototype.updateState = update;
    delete win.selectionModelSnapshot;
    delete win.selectionModelUpdated;
    delete win.disposeSelectionModelProbe;
  };
}
