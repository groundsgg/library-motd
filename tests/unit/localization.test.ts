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

it("preserves unknown diagnostic fallback text while formatting explicit host templates", () => {
  const diagnostic: api.Diagnostic = {
    code: "host",
    path: "",
    severity: "warning",
    messageKey: "host.external",
    message: "Server said {count}",
    parameters: { count: 2 },
  };
  expect(api.formatDiagnostic(diagnostic, api.germanLabels)).toBe(
    "Server said {count}",
  );
  expect(
    api.formatDiagnostic(diagnostic, { "host.external": "Anzahl: {count}" }),
  ).toBe("Anzahl: 2");
  expect(
    api.formatDiagnostic({ ...diagnostic, messageKey: "constructor" }),
  ).toBe("Server said {count}");
});

it("reports configurable visible-line limits as language-independent parameters", () => {
  const text = api.parseText(
    "A<newline>B<newline>C<newline>D",
    "minimessage",
  ).value!;
  const result = api.layoutText(text, {
    profile: api.java1211Profile,
    width: 100,
    maxLines: 3,
  });
  const diagnostic = result.diagnostics.find((d) => d.code === "hidden-lines")!;
  expect(diagnostic.parameters).toEqual({ lines: 3 });
  expect(diagnostic.message).toBe("Only the first 3 lines are visible");
  expect(api.formatDiagnostic(diagnostic, api.germanLabels)).toBe(
    "Nur die ersten 3 Zeilen sind sichtbar.",
  );
});
