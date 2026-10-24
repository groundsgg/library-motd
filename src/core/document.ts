import type {
  CountRule,
  Outcome,
  ServerListDocument,
  TextDocument,
  TextNode,
} from "./model.js";
import { diagnostic, failure } from "./diagnostics.js";

export const createDocument = (
  motd: TextDocument = { revision: 0, nodes: [] },
): ServerListDocument => ({
  schemaVersion: 1,
  motd: { text: structuredClone(motd), alignments: ["left", "left"] },
  version: { mode: "automatic" },
  icon: null,
  players: {
    hidden: false,
    online: { mode: "inherit" },
    maximum: { mode: "inherit" },
  },
  hover: { mode: "inherit" },
  extensions: {},
});
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
function jsonSafe(
  value: unknown,
  seen = new Set<unknown>(),
  depth = 0,
  budget = { n: 0 },
): boolean {
  if (++budget.n > 100_000 || depth > 128) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const ok = (Array.isArray(value) ? value : Object.values(value!)).every((v) =>
    jsonSafe(v, seen, depth + 1, budget),
  );
  seen.delete(value);
  return ok;
}
function validText(v: unknown): v is TextDocument {
  if (!record(v) || !Number.isInteger(v.revision) || !Array.isArray(v.nodes))
    return false;
  const ids = new Set<string>();
  const check = (node: unknown): node is TextNode => {
    if (!record(node) || typeof node.id !== "string" || ids.has(node.id))
      return false;
    ids.add(node.id);
    if (node.type === "text") return typeof node.value === "string";
    if (node.type === "newline") return true;
    if (node.type === "placeholder") return typeof node.name === "string";
    if (node.type === "opaque")
      return (
        typeof node.raw === "string" &&
        [
          "minimessage",
          "legacy-ampersand",
          "legacy-section",
          "properties",
          "json",
        ].includes(String(node.format))
      );
    if (
      node.type !== "group" ||
      !record(node.style) ||
      !Array.isArray(node.children)
    )
      return false;
    const s = node.style;
    if (
      s.color !== undefined &&
      (typeof s.color !== "string" || !/^#[\da-f]{6}$/i.test(s.color))
    )
      return false;
    for (const k of [
      "bold",
      "italic",
      "underlined",
      "strikethrough",
      "obfuscated",
    ])
      if (s[k] !== undefined && typeof s[k] !== "boolean") return false;
    if (
      s.gradientPhase !== undefined &&
      (typeof s.gradientPhase !== "number" || Math.abs(s.gradientPhase) > 1)
    )
      return false;
    if (s.gradient !== undefined) {
      if (!Array.isArray(s.gradient) || s.gradient.length < 2) return false;
      let previous = -1;
      for (const stop of s.gradient) {
        if (
          !record(stop) ||
          typeof stop.color !== "string" ||
          !/^#[\da-f]{6}$/i.test(stop.color) ||
          typeof stop.position !== "number" ||
          stop.position < 0 ||
          stop.position > 1 ||
          stop.position <= previous
        )
          return false;
        previous = stop.position;
      }
    }
    if (
      s.rainbow !== undefined &&
      (!record(s.rainbow) ||
        typeof s.rainbow.phase !== "number" ||
        typeof s.rainbow.reversed !== "boolean")
    )
      return false;
    return node.children.every(check);
  };
  if (!v.nodes.every(check)) return false;
  return (
    v.source === undefined ||
    (record(v.source) &&
      typeof v.source.value === "string" &&
      [
        "minimessage",
        "legacy-ampersand",
        "legacy-section",
        "properties",
        "json",
      ].includes(String(v.source.format)) &&
      Number.isInteger(v.source.revision))
  );
}
function validIcon(value: unknown): boolean {
  if (
    !record(value) ||
    typeof value.pngBase64 !== "string" ||
    value.pngBase64.length > 131072 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value.pngBase64)
  )
    return false;
  try {
    const raw = atob(value.pngBase64),
      bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0)),
      view = new DataView(bytes.buffer);
    if (
      bytes.length < 45 ||
      ![137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) ||
      view.getUint32(8) !== 13 ||
      raw.slice(12, 16) !== "IHDR" ||
      view.getUint32(16) !== 64 ||
      view.getUint32(20) !== 64
    )
      return false;
    let idat = false;
    for (let pos = 8; pos + 12 <= bytes.length;) {
      const length = view.getUint32(pos),
        type = raw.slice(pos + 4, pos + 8);
      if (length > bytes.length - pos - 12) return false;
      if (type === "IDAT") idat = true;
      if (type === "IEND")
        return idat && length === 0 && pos + 12 === bytes.length;
      pos += length + 12;
    }
    return false;
  } catch {
    return false;
  }
}
function validRule(rule: unknown, online: boolean): rule is CountRule {
  return (
    record(rule) &&
    (rule.mode === "inherit" ||
      (["fixed", "offset", "percent", ...(online ? [] : ["headroom"])].includes(
        String(rule.mode),
      ) &&
        typeof rule.value === "number" &&
        Number.isFinite(rule.value) &&
        (rule.mode === "percent" || Number.isInteger(rule.value)) &&
        (rule.mode === "offset" || rule.value >= 0)))
  );
}
export function validateDocument(input: unknown): Outcome<ServerListDocument> {
  if (!jsonSafe(input) || !record(input))
    return failure("invalid-document", "", {
      key: "diagnostic.invalidDocument",
    });
  if (input.schemaVersion !== 1)
    return failure("unsupported-schema", "schemaVersion", {
      key: "diagnostic.unsupportedSchema",
    });
  const diagnostics = [];
  if (
    !record(input.motd) ||
    !validText(input.motd.text) ||
    !Array.isArray(input.motd.alignments) ||
    !input.motd.alignments.every((a) => ["left", "center", "right"].includes(a))
  )
    diagnostics.push(
      diagnostic("invalid-text", "motd", { key: "diagnostic.invalidMotd" }),
    );
  if (
    !record(input.version) ||
    !["automatic", "when-incompatible", "always"].includes(
      String(input.version.mode),
    ) ||
    (input.version.mode !== "automatic" && !validText(input.version.text))
  )
    diagnostics.push(
      diagnostic("invalid-version", "version", {
        key: "diagnostic.invalidVersion",
      }),
    );
  if (!record(input.players))
    diagnostics.push(
      diagnostic("invalid-players", "players", {
        key: "diagnostic.missingPlayerRules",
      }),
    );
  else {
    if (typeof input.players.hidden !== "boolean")
      diagnostics.push(
        diagnostic("invalid-players", "players.hidden", {
          key: "diagnostic.expectedBoolean",
        }),
      );
    for (const field of ["online", "maximum"])
      if (!validRule(input.players[field], field === "online"))
        diagnostics.push(
          diagnostic("invalid-count", `players.${field}`, {
            key: "diagnostic.invalidCount",
          }),
        );
  }
  if (
    !record(input.hover) ||
    !["inherit", "disabled", "custom"].includes(String(input.hover.mode)) ||
    (input.hover.mode === "custom" && !validText(input.hover.text))
  )
    diagnostics.push(
      diagnostic("invalid-hover", "hover", { key: "diagnostic.invalidHover" }),
    );
  if (input.icon !== null && !validIcon(input.icon))
    diagnostics.push(
      diagnostic("invalid-icon", "icon", { key: "diagnostic.invalidIcon" }),
    );
  if (!record(input.extensions))
    diagnostics.push(
      diagnostic("invalid-extensions", "extensions", {
        key: "diagnostic.invalidExtensions",
      }),
    );
  if (diagnostics.length) return { value: null, diagnostics };
  const { schemaVersion, motd, version, icon, players, hover, extensions } =
    input;
  return {
    value: structuredClone({
      schemaVersion,
      motd,
      version,
      icon,
      players,
      hover,
      extensions,
    }) as ServerListDocument,
    diagnostics: [],
  };
}
export function readDocument(json: string): Outcome<ServerListDocument> {
  if (json.length > 2_000_000)
    return failure("document-limit", "", { key: "diagnostic.documentLimit" });
  try {
    return validateDocument(JSON.parse(json));
  } catch {
    return failure("invalid-json", "", { key: "diagnostic.invalidJson" });
  }
}
export function writeDocument(document: ServerListDocument): string {
  const result = validateDocument(document);
  if (!result.value)
    throw new TypeError(
      result.diagnostics.map((d) => `${d.path}: ${d.message}`).join("; "),
    );
  return JSON.stringify(result.value);
}
