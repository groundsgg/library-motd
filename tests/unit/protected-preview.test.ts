import { expect, it } from "vitest";
import * as api from "../../src/index.js";

const plain = (text: api.TextDocument) =>
  api
    .flattenText(text)
    .map((g) => g.text)
    .join("");

it("shows literal descendants of protected events, including empty roots and arrays", () => {
  const raw = {
    text: "",
    click_event: {
      action: "custom",
      payload: { text: "never display payload" },
    },
    extra: [
      {
        text: "Click",
        hoverEvent: {
          action: "show_text",
          contents: { text: "not MOTD text" },
        },
        extra: [" here", [{ text: "!" }]],
      },
    ],
  };
  const source = JSON.stringify(raw, null, 2);
  const parsed = api.parseText(source, "json").value!;
  expect(plain(parsed)).toBe("Click here!");
  expect(parsed.nodes[0]).toMatchObject({
    type: "opaque",
    raw: JSON.stringify(raw),
  });
  expect(api.serializeText(parsed, { format: "json" }).value).toBe(source);
  parsed.revision++;
  parsed.nodes.push({ id: "neighbor", type: "text", value: " next" });
  const exported = JSON.parse(
    api.serializeText(parsed, { format: "json" }).value!,
  );
  expect(JSON.stringify(exported)).toContain(JSON.stringify(raw));
  expect(
    api.serializeText(parsed, { format: "legacy-section", rgb: true }).value,
  ).toBeNull();
  expect(
    api.serializeText(
      parsed,
      { format: "legacy-section", rgb: true },
      { lossy: "reduce" },
    ).value,
  ).toContain("Click here!");
});

it.each([
  {
    translate: "custom.key",
    fallback: "not a guaranteed translation",
    with: [{ text: "argument" }],
  },
  { keybind: "key.jump" },
  { score: { name: "@s", objective: "score" } },
  { selector: "@a" },
  { nbt: "data", storage: "server:values" },
])(
  "keeps context-dependent content unresolved inside literal siblings: %j",
  (dynamic) => {
    const text = api.parseText(
      JSON.stringify({
        text: "Before ",
        unknown: true,
        extra: [dynamic, { text: " after" }],
      }),
      "json",
    ).value!;
    expect(plain(text)).toBe("Before [unsupported component] after");
  },
);

it("keeps HTML-like literal text as data and limits visible protected nesting", () => {
  const value = "<img src=x onerror=alert(1)>";
  const text = api.parseText(
    JSON.stringify({
      text: value,
      clickEvent: { action: "run_command", value: "/test" },
    }),
    "json",
  ).value!;
  expect(plain(text)).toBe(value);
  const deep = JSON.stringify({
    text: "A",
    unknown: true,
    extra: [{ text: "B", extra: [{ text: "C" }] }],
  });
  expect(api.parseText(deep, "json", { maxDepth: 1 }).value).toBeNull();
  expect(plain(api.parseText(deep, "json", { maxDepth: 2 }).value!)).toBe(
    "ABC",
  );
});

it("warns about approximation after document persistence with localized stable codes", () => {
  const parsed = api.parseText(
    '{"text":"Click","clickEvent":{"action":"run_command","value":"/test"}}',
    "json",
  ).value!;
  const saved = api.readDocument(
    api.writeDocument(api.createDocument(parsed)),
  ).value!;
  const layout = api.layoutText(saved.motd.text, {
    profile: api.java1211Profile,
    width: 271,
    maxLines: 2,
  });
  const warning = layout.diagnostics.find(
    (d) => d.code === "protected-preview",
  );
  expect(warning).toMatchObject({
    path: parsed.nodes[0]!.id,
    severity: "warning",
    messageKey: "diagnostic.protectedPreview",
  });
  expect(api.formatDiagnostic(warning!, api.germanLabels)).toContain(
    "Geschützte",
  );
});
