import { expect, it } from "vitest";
import { existsSync } from "node:fs";
import * as core from "../../src/index.js";
it("uses proportional glyph advances and reports unsupported glyphs", () => {
  const profile = core.java1211Profile;
  expect(profile.font.advances["M"]).toBe(6);
  expect(profile.font.advances["i"]).toBe(2);
  expect(profile.font.advances[" "]).toBe(4);
  expect(profile.font.supported("😀")).toBe(false);
  expect(existsSync("assets/java-1.21.1/Minecraft.otf")).toBe(true);
  expect(existsSync("assets/java-1.21.1/OFL.txt")).toBe(true);
});
