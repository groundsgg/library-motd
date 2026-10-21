import { createElement, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ServerListEditor, ServerListPreview } from "../../src/react/index.js";
import { clientProfiles } from "../../src/index.js";
import { context, initialDocument } from "../shared/data.js";
import "../../src/dom/styles.css";
import "../shared/page.css";
function App() {
  const [document, setDocument] = useState(initialDocument);
  const [profile, setProfile] = useState(context.profile);
  const previewContext = {
    ...context,
    profile,
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
    createElement(ServerListEditor, {
      document,
      context: previewContext,
      onChange: setDocument,
    }),
    createElement("div", { className: "output-label" }, "Live preview"),
    createElement(
      "div",
      { className: "preview-output" },
      createElement(ServerListPreview, { document, context: previewContext }),
    ),
  );
}
createRoot(document.getElementById("root")!).render(
  createElement(StrictMode, null, createElement(App)),
);
