import { demoVariableCatalog } from "../shared/variables.js";
import { demoSpriteCatalog } from "../shared/sprites.js";
import {
  clientProfiles,
  englishLabels,
  germanLabels,
} from "../../src/index.js";
import { createEditor, createPreview } from "../../src/dom/index.js";
import {
  context,
  demoPanoramaMotion,
  initialDocument,
} from "../shared/data.js";
import "../../src/dom/styles.css";
import "../shared/page.css";
let document = initialDocument;
let labels: Readonly<Record<string, string>> = englishLabels;
const preview = createPreview(window.document.querySelector("#preview")!, {
  document,
  context,
  labels,
});
const onChange = (next: typeof document) => {
  document = next;
  preview.update({ document, context, labels });
};
const editor = createEditor(window.document.querySelector("#editor")!, {
  document,
  context,
  onChange,
  spriteCatalog: demoSpriteCatalog,
  variableCatalog: demoVariableCatalog,
  labels,
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
  labels =
    query<HTMLSelectElement>("#language").value === "de"
      ? germanLabels
      : englishLabels;
  context.profile = clientProfiles.find((p) => p.id === versions.value)!;
  context.clientProtocol = context.profile.protocol!;
  context.compatible =
    query<HTMLSelectElement>("#protocol").value === "compatible";
  context.background = query<HTMLSelectElement>("#background").value as
    "auto" | "dirt" | "panorama" | "none";
  context.presentation = query<HTMLSelectElement>("#presentation").value as
    "row" | "server-list";
  context.selected = query<HTMLInputElement>("#selected").checked;
  demoPanoramaMotion.paused =
    query<HTMLInputElement>("#panorama-paused").checked;
  demoPanoramaMotion.speed = Number(
    query<HTMLInputElement>("#panorama-speed").value,
  );
  query<HTMLElement>("#panorama-paused-label").textContent =
    labels.pausePanorama;
  query<HTMLElement>("#panorama-speed-label").textContent =
    labels.panoramaSpeed;
  query<HTMLOutputElement>("#panorama-speed-value").textContent =
    `${demoPanoramaMotion.speed}×`;
  query<HTMLElement>("#panorama-demo-note").textContent =
    labels.panoramaDemoNote;
  const toolbar = query<HTMLSelectElement>("#toolbar").value as
    "fixed" | "selection";
  editor.update({
    document,
    context,
    onChange,
    toolbar,
    labels,
    spriteCatalog: demoSpriteCatalog,
    variableCatalog: demoVariableCatalog,
  });
  preview.update({ document, context, labels });
};
for (const id of [
  "#client-version",
  "#protocol",
  "#background",
  "#presentation",
  "#selected",
  "#toolbar",
  "#language",
  "#panorama-paused",
])
  query(id).addEventListener("change", refresh);
query<HTMLInputElement>("#panorama-speed").addEventListener("input", refresh);
refresh();
