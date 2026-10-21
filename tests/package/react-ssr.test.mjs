import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { createElement } from "react";
import {
  ServerListComparison,
  ServerListEditor,
} from "../../dist/react/index.js";
import { createDocument } from "../../dist/index.js";
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
