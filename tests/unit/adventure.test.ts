import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { flattenText, parseText } from "../../src/index.js";
const fixtures = JSON.parse(
  readFileSync("tests/fixtures/text/adventure.json", "utf8"),
);
it.each(fixtures)(
  "matches Adventure 5.2 for $input",
  ({ input, component }) => {
    const normalized = (doc: any) =>
      flattenText(doc).map((c) => ({
        text: c.text,
        color: c.color.toLowerCase(),
        bold: !!c.style.bold,
        italic: !!c.style.italic,
      }));
    expect(normalized(parseText(input, "minimessage").value)).toEqual(
      normalized(parseText(JSON.stringify(component), "json").value),
    );
  },
);
