import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("a one-pixel bitmap cannot retain a grown multi-megabyte atlas", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--expose-gc",
      "--input-type=module",
      "-e",
      `
    import {decodeBitmapGlyphs} from ${JSON.stringify(import.meta.resolve("../../dist/fonts/index.js"))};
    const actualLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
    const shared=new SharedArrayBuffer(4,{maxByteLength:8388608}),pixels=new Uint8Array(shared);
    pixels.set([1,2,3,255]);let reads=0;
    Object.defineProperty(pixels,'byteLength',{get(){if(++reads===2)shared.grow(8388608);return actualLength.call(pixels);}});
    global.gc();const before=process.memoryUsage().arrayBuffers;
    const result=decodeBitmapGlyphs({height:1,ascent:1,chars:['A']},{width:1,height:1,pixels},{maxPixels:1});
    global.gc();const retained=process.memoryUsage().arrayBuffers-before;
    if(result.value?.glyphs[0]?.advance!==2 || retained>65536)throw Error('Bitmap snapshot exceeded its selected extent: '+retained);
    if(result.value.pixelsFor(65).join(',')!=='1,2,3,255')throw Error('Wrong cell');
  `,
    ],
    { encoding: "utf8", timeout: 5000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
