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
  '<div id="editor"></div><script type="module" src="/main.js"></script>',
);
writeFileSync(
  join(directory, "main.js"),
  `import {createDocument,java1211Profile} from '@groundsgg/motd';import {createEditor}from '@groundsgg/motd/dom';import '@groundsgg/motd/styles.css';createEditor(document.querySelector('#editor'),{document:createDocument(),context:{base:{version:{protocol:767,name:'1.21.1'},players:{online:8,max:100,sample:[]},description:''},clientProtocol:767,values:{},profile:java1211Profile,viewportWidth:640,guiScale:2,serverName:'Packed consumer',pingMs:10,animations:false},onChange(){}});`,
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
  await page.getByLabel("Version display").waitFor({ timeout: 5000 });
  await page.getByLabel("Version display").selectOption("always");
  await page.getByLabel("Version inline editor").waitFor();
  console.log(
    "Packed production bundle preserves properties and inline version editing",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
