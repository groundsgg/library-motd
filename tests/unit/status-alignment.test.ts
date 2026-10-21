import { expect, test } from "vitest";
import { createDocument, parseText, evaluateStatus } from "../../src/index.js";
test("alignment affects the exported runtime description", () => {
  const d = createDocument(parseText("X", "minimessage").value!);
  d.motd.alignments = ["center"];
  const r = evaluateStatus(d, {
    base: {
      version: { protocol: 767, name: "1.21.1" },
      players: { online: 1, max: 10, sample: [] },
      description: "",
    },
    clientProtocol: 767,
    values: {},
  });
  expect(JSON.stringify(r.value?.description)).toContain(" ");
});
