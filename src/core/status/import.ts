import type { JavaStatus, Outcome, ServerListDocument } from "../model.js";
import { createDocument, validateDocument } from "../document.js";
import { failure } from "../diagnostics.js";
import { parseText } from "../text/parse.js";
import { normalizeStatusIcon } from "../image/icon.js";
export function importStatus(status: JavaStatus): Outcome<ServerListDocument> {
  try {
    if (
      !status ||
      typeof status.version?.name !== "string" ||
      !Number.isInteger(status.version.protocol)
    )
      return failure("invalid-status", "", {
        key: "diagnostic.invalidStatusVersion",
      });
    const source = JSON.stringify(status.description);
    if (source.length > 65536)
      return failure("text-limit", "motd", {
        key: "diagnostic.statusTextLimit",
      });
    const text = parseText(source, "json");
    if (!text.value) return { value: null, diagnostics: text.diagnostics };
    const doc = createDocument(text.value);
    doc.players.hidden = !status.players;
    if (status.version.protocol < 0) {
      const version = parseText(status.version.name, "legacy-section");
      if (!version.value)
        return { value: null, diagnostics: version.diagnostics };
      doc.version = { mode: "always", text: version.value };
    }
    if (status.players) {
      const p = status.players;
      if (
        !Number.isInteger(p.online) ||
        p.online < 0 ||
        !Number.isInteger(p.max) ||
        p.max < 0
      )
        return failure("invalid-status", "players", {
          key: "diagnostic.invalidStatusPlayers",
        });
      doc.players.online = { mode: "fixed", value: p.online };
      doc.players.maximum = { mode: "fixed", value: p.max };
      if (p.sample?.length) {
        const hover = parseText(
          p.sample.map((p) => p.name).join("\n"),
          "legacy-section",
        );
        if (!hover.value)
          return { value: null, diagnostics: hover.diagnostics };
        doc.hover = { mode: "custom", text: hover.value };
      }
    }
    if (status.favicon) {
      if (!status.favicon.startsWith("data:image/png;base64,"))
        return failure("invalid-icon", "icon", {
          key: "diagnostic.iconDataUri",
        });
      const icon = normalizeStatusIcon({ pngBase64: status.favicon.slice(22) });
      if (!icon.value) return { value: null, diagnostics: icon.diagnostics };
      doc.icon = icon.value;
      const result = validateDocument(doc);
      result.diagnostics.push(...icon.diagnostics);
      return result;
    }
    return validateDocument(doc);
  } catch {
    return failure("invalid-status", "", { key: "diagnostic.invalidStatus" });
  }
}
