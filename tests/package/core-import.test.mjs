import { test } from 'node:test';
import assert from 'node:assert/strict';
test('core imports without DOM or network', async () => {
  globalThis.fetch = () => { throw new Error('Unexpected network'); };
  const { createDocument, writeDocument, readDocument } = await import('../../dist/index.js');
  assert.deepEqual(readDocument(writeDocument(createDocument())).value, createDocument());
  assert.equal('window' in globalThis, false);
});
