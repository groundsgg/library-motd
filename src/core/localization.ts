import type { Diagnostic } from "./model.js";
import { englishLabels } from "../locales/en.js";
export { englishLabels } from "../locales/en.js";
export { germanLabels } from "../locales/de.js";

export type MessageKey = keyof typeof englishLabels;
export type MessageParameters = Readonly<Record<string, string | number>>;
export type LabelOverrides = Readonly<Record<string, string>>;
const ownLabel = (labels: LabelOverrides, key: string): string | undefined =>
  Object.hasOwn(labels, key) && typeof labels[key] === "string"
    ? labels[key]
    : undefined;
export interface DiagnosticMessage {
  key: Extract<MessageKey, `diagnostic.${string}`>;
  parameters?: MessageParameters;
}

/** Substitute named values once; inserted text is never parsed as a template. */
export function interpolateMessage(
  template: string,
  parameters: MessageParameters = {},
): string {
  return template.replace(/\{([\w.]+)\}/g, (token, name: string) =>
    Object.hasOwn(parameters, name) ? String(parameters[name]) : token,
  );
}
export function formatLabel(
  key: string,
  parameters: MessageParameters = {},
  labels: LabelOverrides = {},
  fallback = key,
): string {
  return interpolateMessage(
    ownLabel(labels, key) ?? ownLabel(englishLabels, key) ?? fallback,
    parameters,
  );
}
/** Unknown host diagnostics keep their supplied fallback text. */
export function formatDiagnostic(
  diagnostic: Diagnostic,
  labels: LabelOverrides = {},
): string {
  if (!diagnostic.messageKey) return diagnostic.message;
  return interpolateMessage(
    ownLabel(labels, diagnostic.messageKey) ??
      ownLabel(englishLabels, diagnostic.messageKey) ??
      diagnostic.message,
    diagnostic.parameters,
  );
}
