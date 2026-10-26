import { mkdir, writeFile } from "node:fs/promises";
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
    await writeFile(
      ".browser-diagnostics/graphics-startup.json",
      encodeGraphicsDiagnostics(snapshot),
    );
  } catch {
    /* Diagnostic setup never prevents the browser matrix from running. */
  }
}
