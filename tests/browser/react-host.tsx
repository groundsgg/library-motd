import React, { StrictMode, useState } from "react";
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
  return (
    <>
      <button onClick={() => setShow(!show)}>Toggle editor</button>
      {show && (
        <ServerListEditor
          document={document}
          context={context}
          onChange={setDocument}
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
