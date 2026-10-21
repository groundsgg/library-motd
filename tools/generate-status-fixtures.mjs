import fs from "node:fs";
import {
  createDocument,
  parseText,
  compileStatusTemplate,
  serializeText,
  evaluateStatus,
  resolveText,
  flattenText,
  java1211Profile,
} from "../dist/index.js";
const base = {
  version: { protocol: 767, name: "1.21.1" },
  players: {
    online: 8,
    max: 100,
    sample: [{ name: "Ada", id: "00000000-0000-0000-0000-000000000001" }],
  },
  description: "",
};
const text = (s) => parseText(s, "minimessage").value;
const fixtures = [];
function add(name, modify, clientProtocol = 767) {
  const document = createDocument(
    text("<gold>{{region}}: {{players}} / {{max}}"),
  );
  modify(document);
  const context = {
    base,
    clientProtocol,
    values: { region: "eu", continent: "Europe", localzone: "Europe" },
  };
  const expected = evaluateStatus(document, context);
  if (!expected.value) throw Error(JSON.stringify(expected.diagnostics));
  const values = {
    ...context.values,
    players: String(expected.value.players?.online ?? base.players.online),
    max: String(expected.value.players?.max ?? base.players.max),
  };
  fixtures.push({
    name,
    document,
    template: compileStatusTemplate(document).value,
    source: serializeText(
      document.motd.text,
      { format: "minimessage" },
      document.motd.alignments.some((a) => a !== "left")
        ? {
            layout: {
              profile: java1211Profile,
              width: 271,
              alignments: document.motd.alignments,
            },
          }
        : {},
    ).value,
    context,
    expected: expected.value,
    expectedPlain: flattenText(
      parseText(JSON.stringify(expected.value.description), "json").value,
    )
      .map((c) => c.text)
      .join(""),
  });
}
add("offset-headroom", (d) => {
  d.players.online = { mode: "offset", value: 2 };
  d.players.maximum = { mode: "headroom", value: 10 };
});
add("hidden", (d) => (d.players.hidden = true));
add(
  "custom-hover",
  (d) =>
    (d.hover = {
      mode: "custom",
      text: text("<gold>{{players}} players<newline><green>Welcome"),
    }),
);
add(
  "forced-version",
  (d) => (d.version = { mode: "always", text: text("<red>Maintenance") }),
);
add(
  "compatible-version",
  (d) =>
    (d.version = {
      mode: "when-incompatible",
      text: text("<red>Update required"),
    }),
);
add(
  "incompatible-version",
  (d) =>
    (d.version = {
      mode: "when-incompatible",
      text: text("<red>Update required"),
    }),
  766,
);
add("percent", (d) => {
  d.players.online = { mode: "percent", value: 25 };
  d.players.maximum = { mode: "offset", value: 5 };
});
add(
  "inherited-hover-style",
  (d) =>
    (d.hover = { mode: "custom", text: text("<red>first<newline>second") }),
);
add("aligned-placeholder", (d) => {
  d.motd.alignments = ["center", "left"];
});
fs.mkdirSync("tests/fixtures/status", { recursive: true });
fs.writeFileSync(
  "tests/fixtures/status/contract.json",
  JSON.stringify(fixtures, null, 2) + "\n",
);
