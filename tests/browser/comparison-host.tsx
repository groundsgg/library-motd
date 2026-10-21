import { createElement, StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { createComparison } from "../../src/dom/index.js";
import { ServerListComparison } from "../../src/react/index.js";
import {
  createDocument,
  parseText,
  java1211Profile,
  java263Profile,
} from "../../src/index.js";

const document = createDocument(
  parseText("Hello {{region}}", "minimessage").value!,
);
document.version = {
  mode: "when-incompatible",
  text: parseText("Upgrade", "minimessage").value!,
};
document.hover = {
  mode: "custom",
  text: parseText("Players", "minimessage").value!,
};
const base = {
  version: { protocol: 767, name: "1.21.1" },
  players: { online: 8, max: 100, sample: [] },
  description: "",
};
const options = {
  document,
  clients: [
    {
      id: "old",
      label: "Classic",
      context: {
        base,
        clientProtocol: 767,
        values: { region: "Europe" },
        profile: java1211Profile,
        viewportWidth: 640,
        guiScale: 2,
        serverName: "Demo",
        pingMs: 20,
        animations: false,
      },
    },
    {
      id: "new",
      label: "Modern",
      context: {
        base,
        clientProtocol: java263Profile.protocol!,
        values: { region: "America" },
        profile: java263Profile,
        viewportWidth: 400,
        guiScale: 1,
        serverName: "Demo",
        pingMs: 20,
        animations: false,
      },
    },
  ],
};
const host = window.document.getElementById("app")!;
if (new URLSearchParams(location.search).has("react")) {
  function App() {
    const [show, setShow] = useState(true);
    const [current, setCurrent] = useState(options.document);
    return createElement(
      "div",
      null,
      createElement(
        "button",
        { onClick: () => setShow(!show) },
        "Toggle comparison",
      ),
      createElement(
        "button",
        {
          onClick: () =>
            setCurrent(
              createDocument(parseText("Updated", "minimessage").value!),
            ),
        },
        "Update document",
      ),
      show &&
        createElement(ServerListComparison, { ...options, document: current }),
    );
  }
  createRoot(host).render(createElement(StrictMode, null, createElement(App)));
} else {
  window.comparisonOptions = options;
  window.comparisonDocument = JSON.stringify(document);
  window.comparison = createComparison(host, options);
}
