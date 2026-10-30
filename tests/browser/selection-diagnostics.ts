import { test as base } from "@playwright/test";
import type {
  SelectionModelState,
  SelectionProbeWindow,
} from "./selection-model-probe.js";

interface SelectionEvent {
  at: number;
  type: string;
  trusted?: boolean;
  key?: string;
  inputType?: string;
  nativeComposing?: boolean;
  pixelComposing?: boolean;
  field?: string;
  focused: boolean;
  anchor: { nodeType: number; offset: number; fieldOffset?: number } | null;
  focus: { nodeType: number; offset: number; fieldOffset?: number } | null;
  selectedLength: number;
  pm?: SelectionModelState;
  modelPhase?: "before" | "after";
}
type DiagnosticWindow = SelectionProbeWindow & {
  selectionEvents?: SelectionEvent[];
};

/** Test-only metadata: observes ordering without changing selection or input. */
export const test = base.extend<{ selectionDiagnostics: void }>({
  selectionDiagnostics: [
    async ({ page }, use, testInfo) => {
      await page.addInitScript(() => {
        const win = window as DiagnosticWindow;
        const events: SelectionEvent[] = [];
        win.selectionEvents = events;
        const keys = new Set([
          "Control",
          "Shift",
          "Alt",
          "Meta",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
          "Home",
          "End",
          "Backspace",
          "Delete",
          "Enter",
          "Escape",
          "Tab",
          "Process",
          "Unidentified",
        ]);
        const inputTypes = new Set([
          "insertText",
          "insertCompositionText",
          "insertFromPaste",
          "insertLineBreak",
          "insertParagraph",
          "deleteContentBackward",
          "deleteContentForward",
          "deleteWordBackward",
          "deleteWordForward",
          "historyUndo",
          "historyRedo",
        ]);
        const fieldFor = (root: Element | null) => {
          const field = root?.closest<HTMLElement>("[data-editor-field]")
            ?.dataset.editorField;
          return field && ["motd", "version", "hover"].includes(field)
            ? field
            : undefined;
        };
        const rootFor = (node: Node | null) =>
          (node?.nodeType === 1
            ? (node as Element)
            : node?.parentElement
          )?.closest<HTMLElement>(".ProseMirror") ?? null;
        const position = (
          node: Node | null,
          offset: number,
          root: HTMLElement | null,
        ) => {
          if (!node) return null;
          let fieldOffset: number | undefined;
          if (root?.contains(node)) {
            const range = document.createRange();
            range.selectNodeContents(root);
            range.setEnd(node, offset);
            fieldOffset = range.toString().length;
          }
          return { nodeType: node.nodeType, offset, fieldOffset };
        };
        const record = (
          event?: Event,
          model?: {
            root: HTMLElement;
            phase: "before" | "after";
            state: SelectionModelState;
          },
        ) => {
          try {
            const selection = document.getSelection();
            const root =
              model?.root ??
              rootFor(document.activeElement) ??
              rootFor(selection?.anchorNode ?? null);
            if (!root || !fieldFor(root)) return;
            const key = event instanceof KeyboardEvent ? event.key : undefined;
            const inputType =
              event instanceof InputEvent ? event.inputType : undefined;
            events.push({
              at: performance.now(),
              type: model ? "pm-update" : event!.type,
              trusted: event?.isTrusted,
              key:
                key === undefined ? undefined : keys.has(key) ? key : "other",
              inputType:
                inputType === undefined
                  ? undefined
                  : inputTypes.has(inputType)
                    ? inputType
                    : "other",
              nativeComposing:
                event instanceof InputEvent || event instanceof KeyboardEvent
                  ? event.isComposing
                  : undefined,
              pixelComposing: root.hasAttribute("data-pixel-composing"),
              field: fieldFor(root),
              focused: root.contains(document.activeElement),
              anchor: position(
                selection?.anchorNode ?? null,
                selection?.anchorOffset ?? 0,
                root,
              ),
              focus: position(
                selection?.focusNode ?? null,
                selection?.focusOffset ?? 0,
                root,
              ),
              selectedLength: selection?.toString().length ?? 0,
              pm: model?.state ?? win.selectionModelSnapshot?.(root),
              modelPhase: model?.phase,
            });
            if (events.length > 256) events.shift();
          } catch {
            /* Native state may disappear during replacement; never interfere. */
          }
        };
        win.selectionModelUpdated = (root, phase, state) =>
          record(undefined, { root, phase, state });
        for (const type of [
          "focusin",
          "focusout",
          "keydown",
          "keyup",
          "beforeinput",
          "input",
          "compositionstart",
          "compositionupdate",
          "compositionend",
          "selectionchange",
        ])
          document.addEventListener(type, record, true);
      });
      await use();
      try {
        if (testInfo.status !== testInfo.expectedStatus) {
          let history: unknown;
          try {
            history = await page.evaluate(
              () => (window as DiagnosticWindow).selectionEvents ?? [],
            );
          } catch {
            history = { unavailable: true };
          }
          try {
            await testInfo.attach("native-selection-events.json", {
              body: JSON.stringify(history, null, 2),
              contentType: "application/json",
            });
          } catch {
            /* Preserve the original failure if artifact writing also fails. */
          }
        }
      } finally {
        try {
          await page.evaluate(() =>
            (window as SelectionProbeWindow).disposeSelectionModelProbe?.(),
          );
        } catch {
          /* Closed pages need no cleanup. */
        }
      }
    },
    { auto: true },
  ],
});
export { expect } from "@playwright/test";
