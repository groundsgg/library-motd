import { mkdir, readFile, writeFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
const css = (await readFile("src/dom/styles.css", "utf8"))
  .replace(
    "@import './properties.css';",
    await readFile("src/dom/properties.css", "utf8"),
  )
  .replaceAll("../../assets/", "../assets/");
await writeFile("dist/styles.css", css);
