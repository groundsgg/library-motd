import { afterEach, expect, it, vi } from "vitest";
import { createDocument, parseText } from "../../src/index.js";
import {
  EditorHistory,
  type HistoryEntry,
} from "../../src/dom/editor/history.js";
const text = (value: string) => parseText(value, "minimessage").value!;
const entry = (
  document: HistoryEntry["document"],
  field: string,
): HistoryEntry => ({ document, selection: { field, from: 1, to: 1 } });
afterEach(() => vi.useRealTimers());
it("separates rapid typing undo and redo by text field", () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const history = new EditorHistory(),
    initial = createDocument(text("M"));
  initial.version = { mode: "always", text: text("V") };
  initial.hover = { mode: "custom", text: text("H") };
  const motd = structuredClone(initial);
  motd.motd.text = text("XM");
  const version = structuredClone(motd);
  version.version = { mode: "always", text: text("YV") };
  const hover = structuredClone(version);
  hover.hover = { mode: "custom", text: text("ZH") };
  history.record(entry(initial, "motd"), true);
  history.record(entry(motd, "version"), true);
  history.record(entry(version, "hover"), true);
  expect(history.undo(entry(hover, "hover"))?.document).toEqual(version);
  expect(history.undo(entry(version, "version"))?.document).toEqual(motd);
  expect(history.undo(entry(motd, "motd"))?.document).toEqual(initial);
  expect(history.redo(entry(initial, "motd"))?.document).toEqual(motd);
  expect(history.redo(entry(motd, "version"))?.document).toEqual(version);
  expect(history.redo(entry(version, "hover"))?.document).toEqual(hover);
});
it("continues grouping consecutive typing in the same field", () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const history = new EditorHistory(),
    initial = createDocument(text("M")),
    first = createDocument(text("XM")),
    second = createDocument(text("XYM"));
  history.record(entry(initial, "motd"), true);
  history.record(entry(first, "motd"), true);
  expect(history.undo(entry(second, "motd"))?.document).toEqual(initial);
});
