import { createEditor, createPreview } from "../../src/dom/index.js";
import { context, initialDocument } from "../shared/data.js";
import "../../src/dom/styles.css";
import "../shared/page.css";
let document = initialDocument;
const preview = createPreview(window.document.querySelector("#preview")!, {
  document,
  context,
});
const onChange = (next: typeof document) => {
  document = next;
  preview.update({ document, context });
};
const editor = createEditor(window.document.querySelector("#editor")!, {
  document,
  context,
  onChange,
});
window.document
  .querySelector<HTMLSelectElement>("#protocol")!
  .addEventListener("change", (event) => {
    context.clientProtocol = Number((event.target as HTMLSelectElement).value);
    editor.update({ document, context, onChange });
    preview.update({ document, context });
  });
