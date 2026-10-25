import { test as base } from "@playwright/test";

interface SelectionEvent {
  at: number;
  type: string;
  key?: string;
  inputType?: string;
  field?: string;
  anchor: { node: string; offset: number } | null;
  focus: { node: string; offset: number } | null;
  selected: string;
  selectedLength: number;
}
type DiagnosticWindow = Window & { selectionEvents?: SelectionEvent[] };

/** Observe native ordering without changing selection, input or event delivery. */
export const test = base.extend<{ selectionDiagnostics: void }>({
  selectionDiagnostics: [
    async ({ page }, use, testInfo) => {
      await page.addInitScript(() => {
        const events: SelectionEvent[] = [];
        (window as DiagnosticWindow).selectionEvents = events;
        const position = (node: Node | null, offset: number) =>
          node
            ? {
                node: node.nodeName + ":" + node.textContent?.slice(0, 80),
                offset,
              }
            : null;
        const record = (event: Event) => {
          const selection = document.getSelection();
          const selected = selection?.toString() ?? "";
          events.push({
            at: performance.now(),
            type: event.type,
            key: event instanceof KeyboardEvent ? event.key : undefined,
            inputType:
              event instanceof InputEvent ? event.inputType : undefined,
            field: document.activeElement?.closest<HTMLElement>(
              "[data-editor-field]",
            )?.dataset.editorField,
            anchor: position(
              selection?.anchorNode ?? null,
              selection?.anchorOffset ?? 0,
            ),
            focus: position(
              selection?.focusNode ?? null,
              selection?.focusOffset ?? 0,
            ),
            selected: selected.slice(0, 160),
            selectedLength: selected.length,
          });
          if (events.length > 256) events.shift();
        };
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
      if (testInfo.status !== testInfo.expectedStatus) {
        let history: unknown;
        try {
          history = await page.evaluate(
            () => (window as DiagnosticWindow).selectionEvents ?? [],
          );
        } catch (error) {
          history = { unavailable: String(error) };
        }
        await testInfo.attach("native-selection-events.json", {
          body: JSON.stringify(history, null, 2),
          contentType: "application/json",
        });
      }
    },
    { auto: true },
  ],
});
export { expect } from "@playwright/test";
