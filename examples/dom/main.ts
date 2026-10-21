import { clientProfiles } from "../../src/index.js";
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
const query = <T extends HTMLElement>(id: string) =>
  window.document.querySelector<T>(id)!;
const versions = query<HTMLSelectElement>("#client-version");
for (const profile of clientProfiles) {
  const option = new Option(profile.clientVersion, profile.id);
  option.selected = profile.id === context.profile.id;
  versions.add(option);
}
const refresh = () => {
  context.profile = clientProfiles.find((p) => p.id === versions.value)!;
  context.clientProtocol = context.profile.protocol!;
  context.compatible =
    query<HTMLSelectElement>("#protocol").value === "compatible";
  context.background = query<HTMLSelectElement>("#background").value as
    "auto" | "dirt" | "panorama" | "none";
  context.presentation = query<HTMLSelectElement>("#presentation").value as
    "row" | "server-list";
  context.selected = query<HTMLInputElement>("#selected").checked;
  editor.update({ document, context, onChange });
  preview.update({ document, context });
};
for (const id of [
  "#client-version",
  "#protocol",
  "#background",
  "#presentation",
  "#selected",
])
  query(id).addEventListener("change", refresh);
