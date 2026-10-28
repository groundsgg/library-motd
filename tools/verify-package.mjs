import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const packed = process.env.MOTD_PACKAGE_TARBALL
  ? { filename: process.env.MOTD_PACKAGE_TARBALL }
  : JSON.parse(execFileSync(npm, ["pack", "--json"], { encoding: "utf8" }))[0];
const tar = resolve(packed.filename);
const directory = mkdtempSync(join(tmpdir(), "motd-consumer-"));
writeFileSync(
  join(directory, "package.json"),
  JSON.stringify({ private: true, type: "module" }),
);
execFileSync(npm, ["install", "--ignore-scripts", "--omit=optional", tar], {
  cwd: directory,
  stdio: "pipe",
});
execFileSync(
  process.execPath,
  [
    "--input-type=module",
    "-e",
    "import {createDocument,parseText,evaluateStatus} from '@groundsgg/motd';const d=createDocument(parseText('<gold>Standalone','minimessage').value);if(!evaluateStatus(d,{base:{version:{protocol:767,name:'1.21.1'},players:{online:8,max:100,sample:[]},description:''},clientProtocol:767,values:{}}).value)throw Error('status');await import('@groundsgg/motd/dom');",
  ],
  { cwd: directory, stdio: "inherit" },
);
if (existsSync(join(directory, "node_modules/react")))
  throw Error("Core consumer unexpectedly installed React");
for (const name of ["font-providers", "font-byte-bounds"]) {
  const file = `${name}.test.mjs`;
  writeFileSync(
    join(directory, file),
    readFileSync(`tests/package/${file}`, "utf8")
      .replaceAll("../../dist/fonts/index.js", "@groundsgg/motd/fonts")
      .replaceAll("../../dist/index.js", "@groundsgg/motd"),
  );
  execFileSync(process.execPath, ["--test", file], {
    cwd: directory,
    stdio: "inherit",
  });
}
const root = join(directory, "node_modules/@groundsgg/motd"),
  css = readFileSync(join(root, "dist/styles.css"), "utf8");
for (const [, asset] of css.matchAll(/url\(['"]?([^'")]+)/g))
  if (!existsSync(resolve(root, "dist", asset)))
    throw Error("Missing CSS asset: " + asset);
// Resolve React only after proving that the core consumer does not require it.
const reactVersions = ["react", "react-dom"].map((name) => {
  const { version } = JSON.parse(
    readFileSync(join("node_modules", name, "package.json"), "utf8"),
  );
  return `${name}@${version}`;
});
execFileSync(
  npm,
  ["install", "--ignore-scripts", "--no-save", ...reactVersions],
  { cwd: directory, stdio: "pipe" },
);
writeFileSync(
  join(directory, "react-ssr.test.mjs"),
  readFileSync("tests/package/react-ssr.test.mjs", "utf8")
    .replace("../../dist/react/index.js", "@groundsgg/motd/react")
    .replace("../../dist/fonts/index.js", "@groundsgg/motd/fonts")
    .replace("../../dist/index.js", "@groundsgg/motd"),
);
execFileSync(process.execPath, ["--test", "react-ssr.test.mjs"], {
  cwd: directory,
  stdio: "inherit",
});
for (const required of ["LICENSE", "CHANGELOG.md", "THIRD_PARTY_NOTICES.md"]) {
  if (!existsSync(join(root, required)))
    throw new Error(`Package is missing ${required}`);
}
console.log(
  "Verified packed Node + DOM without React, local CSS assets, React SSR:",
  tar,
);
// Exercise the installed artifact through a production bundler; source imports do not prove tree shaking safety.
const { build, preview } = await import("vite");
writeFileSync(
  join(directory, "index.html"),
  '<div id="editor"></div><div id="packed-viewer"></div><div id="packed-legacy-viewer"></div><script type="module" src="/main.js"></script>',
);
writeFileSync(
  join(directory, "main.js"),
  `import {createDocument,parseText,java1211Profile,java263Profile} from '@groundsgg/motd';
import {createEditor,createPreview} from '@groundsgg/motd/dom';
import {decodeBitmapGlyphs,createFontGlyphSource} from '@groundsgg/motd/fonts';
import '@groundsgg/motd/styles.css';
const context={base:{version:{protocol:767,name:'1.21.1'},players:{online:8,max:100,sample:[]},description:''},clientProtocol:767,values:{},profile:java1211Profile,viewportWidth:640,guiScale:2,serverName:'Packed consumer',pingMs:10,animations:false};
createEditor(document.querySelector('#editor'),{document:createDocument(),context,onChange(){}});
const glyphs=decodeBitmapGlyphs({height:1,ascent:1,chars:['A']},{width:1,height:1,pixels:new Uint8Array([255,0,0,255])}).value;
const motdFontSource=createFontGlyphSource([{type:'bitmap',glyphs}]).value;
createPreview(document.querySelector('#packed-viewer'),{document:createDocument(parseText('<white>A','minimessage').value),context:{...context,profile:java263Profile,clientProtocol:777},motdFontSource});
createPreview(document.querySelector('#packed-legacy-viewer'),{document:createDocument(parseText('<white><u>A</u>','minimessage').value),context:{...context,profile:{...java1211Profile,geometry:{...java1211Profile.geometry,motdShadow:true}}},motdFontSource});`,
);
await build({ root: directory, logLevel: "warn", build: { outDir: "build" } });
const server = await preview({
  root: directory,
  logLevel: "warn",
  build: { outDir: "build" },
  preview: { host: "127.0.0.1", port: 4183, strictPort: true },
});
const { chromium } = await import("@playwright/test");
let browser;
try {
  browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  );
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4183");
  await page
    .getByRole("button", { name: "Server entry tools", exact: true })
    .click({ timeout: 5000 });
  await page
    .getByRole("button", { name: "Version settings", exact: true })
    .click();
  await page.getByLabel("Version display").selectOption("always");
  await page.getByLabel("Version inline editor").waitFor();
  const imported = page.locator("#packed-viewer .mcp-runtime-ink");
  await imported.waitFor();
  const paintedRed = await imported.evaluate((canvas) => {
    const pixels = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some(
      (value, index) =>
        index % 4 === 0 &&
        value === 255 &&
        pixels[index + 1] === 0 &&
        pixels[index + 2] === 0 &&
        pixels[index + 3] === 255,
    );
  });
  if (!paintedRed)
    throw Error("Packed runtime font did not preserve its original RGBA ink");
  const legacy = page.locator("#packed-legacy-viewer .mcp-runtime-glyph");
  await legacy.waitFor();
  const layers = await legacy.evaluate((span) => ({
    stacking: getComputedStyle(span).zIndex,
    passes: [...span.querySelectorAll("canvas")].map(
      (c) => c.dataset.runtimeLayer,
    ),
  }));
  if (
    layers.stacking !== "auto" ||
    layers.passes.join(",") !==
      "shadow-ink,shadow-effects,foreground-ink,foreground-effects"
  )
    throw Error(
      "Packed legacy runtime font lost its native text-pass stacking",
    );
  console.log(
    "Packed production bundle preserves properties, inline version editing, runtime font ink and legacy text passes",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
