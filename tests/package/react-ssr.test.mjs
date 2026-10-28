import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import {
  ServerListComparison,
  ServerListEditor,
  ServerListPreview,
} from "../../dist/react/index.js";
import { createDocument } from "../../dist/index.js";
import { createFontGlyphSource } from "../../dist/fonts/index.js";
test("React adapter imports and renders on the server without DOM", () => {
  assert.equal(
    renderToString(
      createElement(ServerListEditor, {
        document: createDocument(),
        context: {},
        onChange() {},
      }),
    ),
    "<div></div>",
  );
});

test("React viewer accepts an explicit runtime source during SSR without materializing it", () => {
  const motdFontSource = createFontGlyphSource([
    { type: "space", advances: { A: 3 } },
  ]).value;
  assert.equal(
    renderToString(
      createElement(ServerListPreview, {
        document: createDocument(),
        context: {},
        motdFontSource,
      }),
    ),
    "<div></div>",
  );
});

for (const toolbar of ["fixed", "selection"]) {
  test(`React ${toolbar} toolbar and viewer remain safe during server rendering`, () => {
    const props = {
      document: createDocument(),
      context: {},
      onChange() {},
      toolbar,
    };
    assert.equal(
      renderToString(createElement(ServerListEditor, props)),
      "<div></div>",
    );
    assert.equal(
      renderToString(createElement(ServerListPreview, props)),
      "<div></div>",
    );
  });
}

test("React comparison renders on the server without DOM or clients", () => {
  assert.equal(
    renderToString(
      createElement(ServerListComparison, {
        document: createDocument(),
        clients: [],
      }),
    ),
    "<div></div>",
  );
});
