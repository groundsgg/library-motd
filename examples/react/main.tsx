import { createElement, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { ServerListEditor, ServerListPreview } from "../../src/react/index.js";
import { context, initialDocument } from "../shared/data.js";
import "../../src/dom/styles.css";
import "../shared/page.css";
function App() {
  const [document, setDocument] = useState(initialDocument);
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
    createElement(ServerListEditor, {
      document,
      context,
      onChange: setDocument,
    }),
    createElement("div", { className: "output-label" }, "Live preview"),
    createElement(
      "div",
      { className: "preview-output" },
      createElement(ServerListPreview, { document, context }),
    ),
  );
}
createRoot(document.getElementById("root")!).render(
  createElement(StrictMode, null, createElement(App)),
);
