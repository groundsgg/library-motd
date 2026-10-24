import { expect, it } from "vitest";
import * as api from "../../src/index.js";

const options = { profile: api.java1211Profile, width: 50 };
const documentFor = (source: string) =>
  api.createDocument(api.parseText(source, "minimessage").value!);
const plain = (document: api.ServerListDocument) =>
  api
    .flattenText(document.motd.text)
    .map((c) => c.text)
    .join("");

it("offers detached exact gradients without changing source or unrelated fields", () => {
  const text = api.parseText(
    "&#ff0000A&#cc3300B&#996600C&#669900D&#33cc00E&#00ff00F",
    "legacy-ampersand",
  ).value!;
  const document = api.createDocument(text);
  document.extensions.host = { keep: true };
  const before = JSON.stringify(document);
  const proposals = api.suggestImportAssistance(document, options);
  const proposal = proposals.find((p) => p.kind === "gradient")!;
  expect(proposal.field).toBe("motd");
  expect(proposal.maximumColorError).toBe(0);
  expect(
    api.flattenText(proposal.candidate.motd.text).map((c) => c.color),
  ).toEqual(api.flattenText(text).map((c) => c.color));
  expect(proposal.candidate.extensions).toEqual(document.extensions);
  proposal.candidate.extensions.host = null;
  expect(JSON.stringify(document)).toBe(before);
  expect(JSON.stringify(proposal.original)).toBe(before);
});

it("recognizes measured center/right padding on two explicit lines", () => {
  const document = documentFor("    ABC<newline>        ABC");
  const before = JSON.stringify(document);
  const proposal = api
    .suggestImportAssistance(document, options)
    .find((p) => p.kind === "alignment")!;
  expect(proposal.candidate.motd.alignments).toEqual(["center", "right"]);
  expect(plain(proposal.candidate)).toBe("ABC\nABC");
  expect(proposal.removedPadding).toBe(12);
  expect(proposal.maximumPositionError).toBe(0);
  expect(JSON.stringify(document)).toBe(before);
});

it("retains trailing whitespace and measures styled padding advances", () => {
  const trailing = api
    .suggestImportAssistance(documentFor("    ABC  "), {
      ...options,
      width: 58,
    })
    .find((p) => p.kind === "alignment")!;
  expect(plain(trailing.candidate)).toBe("ABC  ");
  const bold = api
    .suggestImportAssistance(documentFor("<bold>    AB</bold>"), {
      ...options,
      width: 54,
    })
    .find((p) => p.kind === "alignment")!;
  expect(bold.candidate.motd.alignments).toEqual(["center", "left"]);
  expect(
    api.flattenText(bold.candidate.motd.text).every((c) => c.style.bold),
  ).toBe(true);
  expect(bold.maximumPositionError).toBe(0);
});

it("skips placeholders, protected nodes, effects, wrapped and oversized fields", () => {
  for (const source of [
    "    {{players}}",
    "<gradient:red:blue>    ABC</gradient>",
    "<rainbow>    ABC</rainbow>",
    "    " + "M".repeat(2050),
    "    " + "M".repeat(30),
  ]) {
    expect(
      api.suggestImportAssistance(documentFor(source), options),
      source,
    ).toEqual([]);
  }
  const protectedDocument = api.createDocument(
    api.parseText('{"translate":"protected.key","fallback":"    ABC"}', "json")
      .value!,
  );
  expect(api.suggestImportAssistance(protectedDocument, options)).toEqual([]);
  expect(api.suggestImportAssistance(documentFor("plain"), options)).toEqual(
    [],
  );
});

it("requires explicit bounded tolerances and reports position deviation", () => {
  const document = documentFor("    ABC");
  expect(
    api.suggestImportAssistance(document, { ...options, width: 54 }),
  ).toEqual([]);
  const proposal = api
    .suggestImportAssistance(document, {
      ...options,
      width: 54,
      positionTolerance: 4,
    })
    .find((p) => p.kind === "alignment")!;
  expect(proposal.maximumPositionError).toBe(4);
  for (const tolerance of [-1, NaN, Infinity, 256])
    expect(
      api.suggestImportAssistance(document, {
        ...options,
        colorTolerance: tolerance,
      }),
    ).toEqual([]);
  expect(
    api.suggestImportAssistance(document, { ...options, positionTolerance: 5 }),
  ).toEqual([]);
});

it("rejects oversized grouped fields before flattening them", () => {
  const document = api.createDocument({
    revision: 0,
    nodes: [
      {
        id: "large-group",
        type: "group",
        style: { color: "#ff0000" },
        children: [
          { id: "large-text", type: "text", value: "A".repeat(130000) },
        ],
      },
    ],
  });
  expect(api.validateDocument(document).value).not.toBeNull();
  expect(api.suggestImportAssistance(document, options)).toEqual([]);
});
