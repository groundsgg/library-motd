import { expect, it } from "vitest";
import * as api from "../../src/index.js";

it("exports complete standalone English/German catalogs and named interpolation", () => {
  expect(typeof api.formatLabel).toBe("function");
  expect(Object.keys(api.germanLabels).sort()).toEqual(
    Object.keys(api.englishLabels).sort(),
  );
  expect(api.formatLabel("lineAlignment", { line: 2 }, api.germanLabels)).toBe(
    "Ausrichtung für Zeile 2",
  );
  expect(
    api.formatLabel(
      "lineAlignment",
      { line: 2 },
      { lineAlignment: "Zeile {line}: Ausrichtung" },
    ),
  ).toBe("Zeile 2: Ausrichtung");
  expect(api.formatLabel("bold", {}, {})).toBe("Bold");
});

it("keeps diagnostic codes and parameters separate from translated text", () => {
  expect(typeof api.formatDiagnostic).toBe("function");
  const source = api.parseText("{{players}}", "minimessage").value!;
  const diagnostic = api.resolveText(source, {}).diagnostics[0]!;
  expect(diagnostic.code).toBe("unknown-placeholder");
  expect(diagnostic.messageKey).toBe("diagnostic.unknownPlaceholder");
  expect(diagnostic.parameters).toEqual({ name: "players" });
  expect(diagnostic.message).toBe("No value for {{players}}");
  expect(api.formatDiagnostic(diagnostic, api.germanLabels)).toBe(
    "Für {{players}} ist kein Wert vorhanden.",
  );
  expect(
    api.formatDiagnostic(
      { code: "host", path: "", severity: "warning", message: "Host detail" },
      api.germanLabels,
    ),
  ).toBe("Host detail");
});

it("keeps named parameters complete in every German translation", () => {
  const parameters = (text: string) =>
    [...text.matchAll(/\{([\w.]+)\}/g)].map((match) => match[1]).sort();
  for (const key of Object.keys(
    api.englishLabels,
  ) as (keyof typeof api.englishLabels)[])
    expect(parameters(api.germanLabels[key]), key).toEqual(
      parameters(api.englishLabels[key]),
    );
});

it("treats unknown keys and inserted parameters as literal data", () => {
  expect(() => api.formatLabel("constructor")).not.toThrow();
  expect(api.formatLabel("constructor")).toBe("constructor");
  expect(api.formatLabel("toString")).toBe("toString");
  expect(api.formatLabel("lineAlignment", { line: "<b>{line}</b>" })).toBe(
    "Line <b>{line}</b> alignment",
  );
  expect(api.formatLabel("lineAlignment")).toBe("Line {line} alignment");
});
