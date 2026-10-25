import { createElement, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ServerListEditor, ServerListPreview } from "../../src/react/index.js";
import {
  clientProfiles,
  englishLabels,
  germanLabels,
} from "../../src/index.js";
import {
  context,
  demoPanoramaMotion,
  initialDocument,
} from "../shared/data.js";
import "../../src/dom/styles.css";
import "../shared/page.css";
function App() {
  const [document, setDocument] = useState(initialDocument);
  const [language, setLanguage] = useState("en");
  const labels = language === "de" ? germanLabels : englishLabels;
  const [profile, setProfile] = useState(context.profile);
  const [toolbar, setToolbar] = useState<"fixed" | "selection">("fixed");
  const [presentation, setPresentation] = useState<"row" | "server-list">(
    "row",
  );
  const [panoramaPaused, setPanoramaPaused] = useState(false);
  const [panoramaSpeed, setPanoramaSpeed] = useState(1);
  const previewContext = {
    ...context,
    profile,
    presentation,
    clientProtocol: profile.protocol!,
  };
  return createElement(
    "div",
    { className: "shell" },
    createElement(
      "header",
      null,
      createElement("div", { className: "wordmark" }, "grounds. / React"),
      createElement("a", { href: "../dom/" }, "DOM example ↗"),
    ),
    createElement("h1", null, "One document. Every surface."),
    createElement(
      "p",
      null,
      "Controlled React editor with shared undo, local assets and no backend.",
    ),
    createElement(
      "label",
      null,
      "Interface language ",
      createElement(
        "select",
        {
          value: language,
          "aria-label": "Interface language",
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            setLanguage(e.target.value),
        },
        createElement("option", { value: "en" }, "English"),
        createElement("option", { value: "de" }, "Deutsch"),
      ),
    ),
    createElement(
      "label",
      null,
      "Client version ",
      createElement(
        "select",
        {
          value: profile.id,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            setProfile(clientProfiles.find((p) => p.id === e.target.value)!),
        },
        clientProfiles.map((p) =>
          createElement("option", { key: p.id, value: p.id }, p.clientVersion),
        ),
      ),
    ),
    createElement(
      "label",
      null,
      " Toolbar ",
      createElement(
        "select",
        {
          value: toolbar,
          "aria-label": "Toolbar placement",
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            setToolbar(e.target.value as "fixed" | "selection"),
        },
        createElement("option", { value: "fixed" }, "Fixed"),
        createElement("option", { value: "selection" }, "At selection"),
      ),
    ),
    createElement(
      "label",
      null,
      " Presentation ",
      createElement(
        "select",
        {
          value: presentation,
          "aria-label": "Presentation",
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            setPresentation(e.target.value as "row" | "server-list"),
        },
        createElement("option", { value: "row" }, "Server row only"),
        createElement("option", { value: "server-list" }, "Server list"),
      ),
    ),
    createElement(
      "label",
      null,
      createElement("input", {
        id: "panorama-paused",
        type: "checkbox",
        checked: panoramaPaused,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          demoPanoramaMotion.paused = e.target.checked;
          setPanoramaPaused(e.target.checked);
        },
      }),
      " ",
      labels.pausePanorama,
    ),
    createElement(
      "label",
      null,
      labels.panoramaSpeed,
      createElement("input", {
        id: "panorama-speed",
        type: "range",
        min: -10,
        max: 10,
        step: 0.5,
        value: panoramaSpeed,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
          const speed = Number(e.target.value);
          demoPanoramaMotion.speed = speed;
          setPanoramaSpeed(speed);
        },
      }),
      createElement(
        "output",
        { id: "panorama-speed-value" },
        `${panoramaSpeed}×`,
      ),
    ),
    createElement("p", null, labels.panoramaDemoNote),
    createElement(ServerListEditor, {
      document,
      context: previewContext,
      onChange: setDocument,
      toolbar,
      labels,
    }),
    createElement("div", { className: "output-label" }, "Live preview"),
    createElement(
      "div",
      { className: "preview-output" },
      createElement(ServerListPreview, {
        document,
        context: previewContext,
        labels,
      }),
    ),
  );
}
createRoot(document.getElementById("root")!).render(
  createElement(StrictMode, null, createElement(App)),
);
