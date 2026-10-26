import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  collectGraphicsSnapshot,
  encodeGraphicsDiagnostics,
} from "./linux-graphics-diagnostics.mjs";

export default async function graphicsSetup() {
  if (process.platform !== "linux" || process.env.GITHUB_ACTIONS !== "true")
    return;
  try {
    const snapshot = await collectGraphicsSnapshot();
    await mkdir(".browser-diagnostics", { recursive: true });
    for (const name of await readdir(".browser-diagnostics")) {
      if (
        /^(?:glx-(?:chromium|firefox|webkit)-[\da-f-]+\.json|\.glx-[\da-f-]+\.tmp)$/.test(
          name,
        )
      ) {
        await rm(path.join(".browser-diagnostics", name), { force: true });
      }
    }
    await writeFile(
      ".browser-diagnostics/graphics-startup.json",
      encodeGraphicsDiagnostics(snapshot),
    );
  } catch {
    /* Diagnostic setup never prevents the browser matrix from running. */
  }
}
