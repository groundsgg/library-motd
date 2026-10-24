import type {
  Outcome,
  ParseOptions,
  TextDocument,
  TextFormat,
} from "../model.js";
import { failure } from "../diagnostics.js";
import { parseMiniMessage } from "./minimessage.js";
import { parseLegacy } from "./legacy.js";
import { parseJsonText } from "./json.js";
import { decodeProperties } from "./properties.js";
export function parseText(
  input: string,
  format: TextFormat,
  options: ParseOptions = {},
): Outcome<TextDocument> {
  if (typeof input !== "string")
    return failure("invalid-text", "", { key: "diagnostic.expectedString" });
  if (input.length > (options.maxTextLength ?? 65536))
    return failure("text-limit", "", { key: "diagnostic.textLimit" });
  if (format === "minimessage") return parseMiniMessage(input, options);
  try {
    const doc =
      format === "json"
        ? parseJsonText(JSON.parse(input), options.maxDepth)
        : format === "properties"
          ? parseLegacy(decodeProperties(input), "§")
          : parseLegacy(input, format === "legacy-ampersand" ? "&" : "§");
    doc.source = { format, value: input, revision: 0 };
    return { value: doc, diagnostics: [] };
  } catch {
    return failure("invalid-text", "", { key: "diagnostic.invalidText" });
  }
}
