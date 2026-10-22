import React, { StrictMode, useState, useLayoutEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { ServerListEditor } from "../../src/react/index.js";
import { createDocument, parseText, java1211Profile } from "../../src/index.js";
const context = {
  base: {
    version: { protocol: 767, name: "1.21.1" },
    players: { online: 5, max: 100, sample: [] },
    description: "",
  },
  clientProtocol: 767,
  values: {},
  profile: java1211Profile,
  viewportWidth: 640,
  guiScale: 2,
  serverName: "React demo",
  pingMs: 20,
  animations: false,
};
function App() {
  const [document, setDocument] = useState(() =>
    createDocument(parseText("Editable", "minimessage").value!),
  );
  const [show, setShow] = useState(true);
  const [serverName, setServerName] = useState(context.serverName);
  const previewContext = useMemo(
    () => ({ ...context, serverName }),
    [serverName],
  );
  useLayoutEffect(() => {
    // A host measuring the rendered editor during this commit must see its props.
    window.observedServerName =
      window.document.querySelector(".mcp-server-name")?.textContent;
  }, [serverName]);
  const [toolbar, setToolbar] = useState<"fixed" | "selection">("fixed");
  return (
    <>
      <button onClick={() => setShow(!show)}>Toggle editor</button>
      <button
        onClick={() => setToolbar(toolbar === "fixed" ? "selection" : "fixed")}
      >
        Toggle toolbar
      </button>
      <button onClick={() => setServerName("Renamed React server")}>
        Rename server
      </button>
      {show && (
        <ServerListEditor
          document={document}
          context={previewContext}
          onChange={setDocument}
          toolbar={toolbar}
        />
      )}
      <output>{JSON.stringify(document.motd.text)}</output>
    </>
  );
}
createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
