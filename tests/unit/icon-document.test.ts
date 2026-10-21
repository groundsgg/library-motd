import { expect, test } from "vitest";
import { createDocument, validateDocument } from "../../src/index.js";
test("rejects truncated and non-64px icon headers", () => {
  for (const pngBase64 of [
    "iVBORw0KGgo=",
    Buffer.from(
      Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(30).fill(0)]),
    ).toString("base64"),
  ]) {
    const d = createDocument();
    d.icon = { pngBase64 };
    expect(validateDocument(d).value).toBeNull();
  }
});
