import { expect, it } from "vitest";
import { EditorState } from "prosemirror-state";
import {
  parseText,
  serializeText,
  validateDocument,
  createDocument,
} from "../../src/index.js";
import { editorSchema } from "../../src/dom/editor/schema.js";
import {
  fromEditorNode,
  toEditorNode,
  type EditorSourceRange,
} from "../../src/dom/editor/mapping.js";
it("preserves protected nodes and parent gradient identity across a neighbouring edit", () => {
  const raw =
    "<gradient:#ff0000:#0000ff>A<b>B</b><font:custom>C</font>D</gradient>";
  const original = parseText(raw, "minimessage").value!;
  const schema = editorSchema({} as Document, {});
  const pm = toEditorNode(original, schema);
  const state = EditorState.create({ doc: pm, schema });
  const changed = state.apply(state.tr.insertText("x", 1));
  const result = fromEditorNode(changed.doc, original);
  expect(validateDocument(createDocument(result)).value).not.toBeNull();
  const exported = serializeText(result, {
    format: "minimessage",
    rgb: true,
  }).value!;
  expect(exported).toContain("<font:custom>C</font>");
  expect(exported.match(/<gradient:/g)).toHaveLength(1);
  expect(exported).toContain("xA");
});
it("keeps imported third lines and combining sequences in the model", () => {
  const text = parseText("é😀<newline>two<newline>three", "minimessage").value!;
  const schema = editorSchema({} as Document, {});
  const result = fromEditorNode(toEditorNode(text, schema), text);
  expect(
    serializeText(result, { format: "minimessage", rgb: true }).value,
  ).toBe("é😀<newline>two<newline>three");
});

it("maps UTF-16 text and atomic placeholders across lines without changing export semantics", () => {
  const text = parseText(
    "<gradient:#ff0000:#0000ff>é😀{{x}}<newline>W</gradient>",
    "minimessage",
  ).value!;
  const schema = editorSchema({} as Document, {});
  const pm = toEditorNode(text, schema);
  const positions = new Map<string, EditorSourceRange>();
  const result = fromEditorNode(pm, text, positions);
  expect([...positions.values()]).toEqual([
    { from: 1, to: 5, atom: false },
    { from: 5, to: 6, atom: true },
    { from: 8, to: 9, atom: false },
  ]);
  const target = { format: "minimessage" as const, rgb: true };
  expect(serializeText(result, target).value).toBe(
    serializeText(fromEditorNode(pm, text), target).value,
  );
});
