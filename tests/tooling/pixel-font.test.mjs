import { execFileSync } from "node:child_process";
import { test } from "node:test";

test("bundled pixel cells reproduce the checked-in OFL outlines", () => {
  execFileSync(process.execPath, ["tools/build-pixel-font.mjs", "--check"], {
    stdio: "pipe",
  });
});
