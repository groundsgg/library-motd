import type {
  Diagnostic,
  PreviewContext,
  ServerListDocument,
} from "../core/model.js";
import { evaluateStatus } from "../core/status/evaluate.js";
import { createPreview, element, type PreviewHandle } from "./preview.js";
import { entryTextWidth } from "./render.js";

export interface ComparisonClient {
  /** Unique within this comparison; preserved when clients are reordered. */
  id: string;
  label?: string;
  context: PreviewContext;
}
export interface ComparisonOptions {
  document: ServerListDocument;
  clients: readonly ComparisonClient[];
  labels?: Readonly<Record<string, string>>;
}
export type ComparisonField = "version" | "players" | "description" | "favicon";
export interface ComparisonHandle {
  update(options: ComparisonOptions): void;
  destroy(): void;
  getDiagnostics(): ReadonlyMap<string, readonly Diagnostic[]>;
  /** Evaluated status differences relative to the first client. */
  getDifferences(): ReadonlyMap<string, readonly ComparisonField[]>;
}
interface Panel {
  root: HTMLElement;
  title: HTMLElement;
  details: HTMLElement;
  differences: HTMLElement;
  diagnostics: HTMLElement;
  preview: PreviewHandle;
}
const fieldLabels: Record<ComparisonField, string> = {
  version: "Version",
  players: "Players",
  description: "MOTD",
  favicon: "Icon",
};
const fields = Object.keys(fieldLabels) as ComparisonField[];
function validateClients(clients: readonly ComparisonClient[]): void {
  const ids = new Set<string>();
  for (const client of clients) {
    if (!client.id.trim() || ids.has(client.id))
      throw new Error("Comparison client IDs must be nonempty and unique");
    ids.add(client.id);
  }
}
export function createComparison(
  host: HTMLElement,
  initial: ComparisonOptions,
): ComparisonHandle {
  validateClients(initial.clients);
  const doc = host.ownerDocument;
  const root = element(doc, "section", "mcp-comparison");
  const panels = new Map<string, Panel>();
  let destroyed = false;
  let diagnostics = new Map<string, readonly Diagnostic[]>();
  let differences = new Map<string, readonly ComparisonField[]>();
  host.append(root);

  function update(options: ComparisonOptions): void {
    if (destroyed) return;
    validateClients(options.clients);
    const labels = options.labels ?? {};
    const label = (key: string, fallback: string) =>
      formatLabel(key, {}, labels, fallback);
    const selected = new Set(options.clients.map((client) => client.id));
    for (const [id, panel] of panels) {
      if (selected.has(id)) continue;
      panel.preview.destroy();
      panel.root.remove();
      panels.delete(id);
    }
    root.querySelector(".mcp-comparison-empty")?.remove();
    diagnostics = new Map();
    differences = new Map();
    const statuses = options.clients.map(
      (client) =>
        evaluateStatus(options.document, {
          ...client.context,
          motdLayout: {
            profile: client.context.profile,
            width: entryTextWidth(client.context),
          },
        }).value,
    );
    const baseline = statuses[0];
    options.clients.forEach((client, index) => {
      const previewOptions = {
        document: options.document,
        context: client.context,
        labels,
      };
      let panel = panels.get(client.id);
      if (!panel) {
        const section = element(doc, "section", "mcp-comparison-panel");
        section.dataset.clientId = client.id;
        const title = element(doc, "h3", "mcp-comparison-title");
        const details = element(doc, "p", "mcp-comparison-context");
        const viewport = element(doc, "div", "mcp-comparison-viewport");
        const difference = element(doc, "p", "mcp-comparison-differences");
        const notes = element(doc, "ul", "mcp-comparison-diagnostics");
        section.append(title, details, viewport, difference, notes);
        panel = {
          root: section,
          title,
          details,
          differences: difference,
          diagnostics: notes,
          preview: createPreview(viewport, previewOptions),
        };
        panels.set(client.id, panel);
      } else panel.preview.update(previewOptions);
      root.append(panel.root);
      const context = client.context;
      panel.title.textContent = client.label ?? context.profile.clientVersion;
      panel.root.setAttribute("aria-label", panel.title.textContent);
      const background =
        panel.root.querySelector<HTMLElement>(".mcp-stage")?.dataset.background;
      panel.details.textContent = [
        context.profile.clientVersion,
        `${label("comparisonProtocol", "Protocol")}: ${context.clientProtocol}`,
        `${label("comparisonScale", "GUI scale")}: ${context.guiScale}`,
        `${label("comparisonBackground", "Background")}: ${label(`background.${background ?? "none"}`, background ?? "none")}`,
      ].join(" · ");
      const changed = fields.filter(
        (field) =>
          JSON.stringify(statuses[index]?.[field]) !==
          JSON.stringify(baseline?.[field]),
      );
      differences.set(client.id, changed);
      panel.root.dataset.differences = changed.join(" ");
      panel.differences.textContent =
        index === 0
          ? label("comparisonReference", "Reference preview")
          : changed.length
            ? `${label("comparisonDifferences", "Different from reference")}: ${changed.map((field) => label(`comparisonField.${field}`, fieldLabels[field])).join(", ")}`
            : label("comparisonSame", "Same evaluated status as reference");
      const notes = panel.preview.getDiagnostics();
      diagnostics.set(client.id, notes);
      panel.diagnostics.replaceChildren();
      panel.diagnostics.setAttribute(
        "aria-label",
        label("comparisonDiagnostics", "Preview diagnostics"),
      );
      for (const note of notes) {
        const item = element(doc, "li", "", formatDiagnostic(note, labels));
        item.dataset.code = note.code;
        panel.diagnostics.append(item);
      }
      panel.diagnostics.hidden = notes.length === 0;
    });
    if (!options.clients.length) {
      const empty = element(
        doc,
        "p",
        "mcp-comparison-empty",
        label("comparisonEmpty", "No clients selected"),
      );
      empty.setAttribute("role", "status");
      root.append(empty);
    }
  }
  update(initial);
  return {
    update,
    getDiagnostics: () =>
      new Map(
        [...diagnostics].map(([id, notes]) => [id, structuredClone(notes)]),
      ),
    getDifferences: () =>
      new Map([...differences].map(([id, changed]) => [id, [...changed]])),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const panel of panels.values()) panel.preview.destroy();
      panels.clear();
      diagnostics.clear();
      differences.clear();
      root.remove();
    },
  };
}
import { formatLabel, formatDiagnostic } from "../core/localization.js";
