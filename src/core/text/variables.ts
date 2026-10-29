import type { VariableCatalogEntry, VariableField } from "../model.js";

export const isVariableName = (name: unknown): name is string =>
  typeof name === "string" && name.length <= 128 && /^[\w.-]+$/.test(name);

export interface ListVariablesOptions {
  /** Omitted discovers own preview-value keys; an explicit catalog is authoritative. */
  catalog?: readonly VariableCatalogEntry[];
  field?: VariableField;
}

/** Catalog metadata never registers, substitutes or persists a variable value. */
export function listVariables(
  values: Readonly<Record<string, string>>,
  options: ListVariablesOptions = {},
): VariableCatalogEntry[] {
  const entries =
    options.catalog === undefined
      ? Object.keys(values)
          .slice(0, 4096)
          .map((name) => ({ name }))
      : Array.isArray(options.catalog)
        ? options.catalog.slice(0, 4096)
        : [];
  const seen = new Set<string>(),
    result: VariableCatalogEntry[] = [];
  for (const entry of entries) {
    if (!entry || !isVariableName(entry.name)) continue;
    const fields = entry.fields;
    if (
      fields !== undefined &&
      (!Array.isArray(fields) ||
        !fields.length ||
        !fields.every((field: unknown) =>
          ["motd", "version", "hover"].includes(field as string),
        ) ||
        (options.field && !fields.includes(options.field)))
    )
      continue;
    if (seen.has(entry.name)) continue;
    seen.add(entry.name);
    result.push({
      name: entry.name,
      ...(typeof entry.label === "string" ? { label: entry.label } : {}),
      ...(typeof entry.description === "string"
        ? { description: entry.description }
        : {}),
      ...(typeof entry.exampleValue === "string"
        ? { exampleValue: entry.exampleValue }
        : {}),
      ...(fields ? { fields: [...fields] } : {}),
    });
  }
  return result;
}
