import type { Diagnostic } from "../core/model.js";
import {
  formatDiagnostic,
  formatLabel,
  type LabelOverrides,
} from "../core/localization.js";

export interface LocalizedText {
  owner: DomLocalization;
  resolve(): string;
}
export type LabelText = string | LocalizedText;
export type LabelParameters = Readonly<Record<string, LabelText | number>>;
interface Binding {
  node: WeakRef<Node>;
  attribute?: string;
  value: LocalizedText;
}
const targets = new WeakMap<Node, Map<string, Binding>>();
export const resolveLabel = (value: LabelText): string =>
  typeof value === "string" ? value : value.resolve();

function forget(node: Node, key: string) {
  const previous = targets.get(node)?.get(key);
  if (previous) {
    previous.value.owner.forget(previous);
    targets.get(node)!.delete(key);
  }
}
/** Private per-instance bindings never retain discarded dialogs or controls. */
export class DomLocalization {
  private bindings = new Set<Binding>();
  constructor(private labels: () => LabelOverrides | undefined) {}
  message(
    key: string,
    fallback: LabelText = key,
    parameters: LabelParameters = {},
  ): LocalizedText {
    return {
      owner: this,
      resolve: () =>
        formatLabel(
          key,
          Object.fromEntries(
            Object.entries(parameters).map(([key, value]) => [
              key,
              typeof value === "number" ? value : resolveLabel(value),
            ]),
          ),
          this.labels(),
          resolveLabel(fallback),
        ),
    };
  }
  diagnostics(diagnostics: readonly Diagnostic[]): LocalizedText {
    return {
      owner: this,
      resolve: () =>
        [
          ...new Set(
            diagnostics.map((d) => formatDiagnostic(d, this.labels())),
          ),
        ].join("\n"),
    };
  }
  bind(node: Node, value: LocalizedText, attribute?: string): void {
    const key = attribute ?? "#text";
    forget(node, key);
    const binding: Binding = { node: new WeakRef(node), value, attribute };
    const map = targets.get(node) ?? new Map<string, Binding>();
    map.set(key, binding);
    targets.set(node, map);
    this.bindings.add(binding);
  }
  forget(binding: Binding): void {
    this.bindings.delete(binding);
  }
  update(): void {
    for (const binding of this.bindings) {
      const node = binding.node.deref();
      if (!node) {
        this.bindings.delete(binding);
        continue;
      }
      if (binding.attribute)
        (node as Element).setAttribute(
          binding.attribute,
          binding.value.resolve(),
        );
      else node.nodeValue = binding.value.resolve();
    }
  }
  destroy(): void {
    for (const binding of this.bindings) {
      const node = binding.node.deref();
      if (node) targets.get(node)?.delete(binding.attribute ?? "#text");
    }
    this.bindings.clear();
  }
}

export function appendLabelText(element: Element, value: LabelText): void {
  const text = element.ownerDocument.createTextNode(resolveLabel(value));
  element.append(text);
  if (typeof value !== "string") value.owner.bind(text, value);
}
export function setLabelText(element: Element, value: LabelText): void {
  for (const node of element.childNodes) forget(node, "#text");
  element.replaceChildren();
  appendLabelText(element, value);
}
export function setLabelAttribute(
  element: Element,
  name: string,
  value: LabelText,
): void {
  forget(element, name);
  element.setAttribute(name, resolveLabel(value));
  if (typeof value !== "string") value.owner.bind(element, value, name);
}
