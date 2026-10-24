import type { Diagnostic, Outcome } from "./model.js";
import { formatLabel, type DiagnosticMessage } from "./localization.js";
export const diagnostic = (
  code: string,
  path: string,
  message: DiagnosticMessage,
  severity: Diagnostic["severity"] = "error",
): Diagnostic => ({
  code,
  path,
  severity,
  message: formatLabel(message.key, message.parameters),
  messageKey: message.key,
  ...(message.parameters ? { parameters: message.parameters } : {}),
});
export const failure = <T>(
  code: string,
  path: string,
  message: DiagnosticMessage,
): Outcome<T> => ({
  value: null,
  diagnostics: [diagnostic(code, path, message)],
});
