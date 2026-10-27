import { expect, it } from "vitest";
import {
  resolveFontProviders,
  decodeBitmapGlyphs,
} from "../../src/fonts/index.js";
import { fontByteView } from "../../src/fonts/bytes.js";

const encode = (source: string) => new TextEncoder().encode(source);
const length = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype),
  "byteLength",
)!.get!;

it("fixes the selected extent while the actual backing buffer grows", () => {
  const shared = new SharedArrayBuffer(4, { maxByteLength: 8 });
  const tracking = new Uint8Array(shared);
  const selected = fontByteView(tracking)!;
  shared.grow(8);
  expect(tracking.byteLength).toBe(8);
  expect(selected.byteLength).toBe(4);
});

it("keeps the selected graph byte extent within its validated budget", async () => {
  const small = encode('{"providers":[]}'),
    large = encode('{"providers":[{"type":"space","advances":{"A":4}}]}');
  const shared = new SharedArrayBuffer(small.length, {
      maxByteLength: large.length,
    }),
    data = new Uint8Array(shared);
  data.set(small);
  let reads = 0;
  // Schedule real buffer growth between validation and consumption, without a timing race.
  Object.defineProperty(data, "byteLength", {
    get() {
      if (++reads === 3) {
        shared.grow(large.length);
        data.set(large);
      }
      return length.call(data);
    },
  });
  const result = await resolveFontProviders("demo:a", () => data, {
    limits: { maxDefinitionBytes: small.length, maxTotalBytes: small.length },
  });
  expect(result.diagnostics).toEqual([]);
  expect(result.value?.providers).toEqual([]);
});

it("does not trust a forged byteLength when checking graph budgets", async () => {
  const data = encode('{"providers":[]}');
  Object.defineProperty(data, "byteLength", { value: 1 });
  const result = await resolveFontProviders("demo:a", () => data, {
    limits: { maxDefinitionBytes: 1, maxTotalBytes: 1 },
  });
  expect(result.value).toBeNull();
  expect(result.diagnostics[0]?.code).toBe("font-limit");
});

it("rejects a non-byte view even when its visible tag says Uint8Array", async () => {
  const data = new Float32Array(4);
  new Uint8Array(data.buffer).set(encode('{"providers":[]}'));
  Object.defineProperty(data, Symbol.toStringTag, { value: "Uint8Array" });
  const graph = await resolveFontProviders("demo:a", () => data as any);
  expect(graph.diagnostics[0]?.code).toBe("font-read");
  const pixel = new Float32Array(1);
  Object.defineProperty(pixel, Symbol.toStringTag, { value: "Uint8Array" });
  const bitmap = decodeBitmapGlyphs(
    { height: 1, ascent: 1, chars: ["A"] },
    { width: 1, height: 1, pixels: pixel as any },
  );
  expect(bitmap.diagnostics[0]?.code).toBe("font-bitmap-image");
});

it("uses the real bitmap buffer and offset instead of overridden object properties", () => {
  const pixels = new Uint8Array([1, 2, 3, 255]);
  Object.defineProperty(pixels, "buffer", {
    get() {
      throw Error("host property");
    },
  });
  Object.defineProperty(pixels, "byteOffset", { value: 9000 });
  const result = decodeBitmapGlyphs(
    { height: 1, ascent: 1, chars: ["A"] },
    { width: 1, height: 1, pixels },
  );
  expect(result.diagnostics).toEqual([]);
  expect(result.value?.glyphs[0]?.advance).toBe(2);
  expect([...result.value!.pixelsFor(65)!]).toEqual([1, 2, 3, 255]);
});
