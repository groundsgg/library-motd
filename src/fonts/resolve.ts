import { diagnostic } from "../core/diagnostics.js";
import type { DiagnosticMessage } from "../core/localization.js";
import type { Diagnostic, Outcome } from "../core/model.js";
import type {
  FontFlags,
  FontProvider,
  FontProviderGraph,
  FontProviderLimits,
  FontProviderOptions,
  FontResourceReader,
} from "./types.js";

const defaults: FontProviderLimits = {
  maxFontFiles: 128,
  maxDefinitionBytes: 1048576,
  maxTotalBytes: 4194304,
  maxDepth: 16,
  maxProviderVisits: 4096,
  maxProviders: 1024,
  maxGlyphs: 65536,
  maxOverrides: 4096,
};
const ceilings: FontProviderLimits = {
  maxFontFiles: 1024,
  maxDefinitionBytes: 4194304,
  maxTotalBytes: 33554432,
  maxDepth: 64,
  maxProviderVisits: 65536,
  maxProviders: 16384,
  maxGlyphs: 1114112,
  maxOverrides: 65536,
};
class FontFailure extends Error {
  constructor(readonly detail: Diagnostic) {
    super(detail.message);
  }
}
function fail(
  code: string,
  path: string,
  key: DiagnosticMessage["key"],
  parameters?: DiagnosticMessage["parameters"],
): never {
  throw new FontFailure(diagnostic(code, path, { key, parameters }));
}
function invalid(path: string): never {
  return fail("font-definition", path, "diagnostic.fontDefinition");
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function scalar(value: unknown): value is string {
  if (typeof value !== "string" || [...value].length !== 1) return false;
  const cp = value.codePointAt(0)!;
  return cp < 0xd800 || cp > 0xdfff;
}
function integer(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= -2147483648 &&
    value <= 2147483647
  );
}
function identifier(
  value: unknown,
  path: string,
): { id: string; namespace: string; path: string } {
  if (typeof value !== "string" || value.length > 512)
    return fail("font-resource-id", path, "diagnostic.fontResourceId");
  const parts = value.split(":"),
    namespace = parts.length === 1 ? "minecraft" : parts[0]!,
    resourcePath = parts.at(-1)!;
  const safeSegment = (part: string) =>
    part.length > 0 &&
    !part.endsWith(".") &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part);
  if (
    parts.length > 2 ||
    !/^[a-z0-9_.-]+$/.test(namespace) ||
    !safeSegment(namespace) ||
    !/^[a-z0-9/._-]+$/.test(resourcePath) ||
    !resourcePath.split("/").every(safeSegment)
  )
    return fail("font-resource-id", path, "diagnostic.fontResourceId");
  return { id: `${namespace}:${resourcePath}`, namespace, path: resourcePath };
}
function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

/** Resolve one host-selected resource set. Never reads binary assets or downloads files. */
export async function resolveFontProviders(
  fontId: string,
  read: FontResourceReader,
  options: FontProviderOptions = {},
): Promise<Outcome<FontProviderGraph>> {
  try {
    const limits = { ...defaults };
    if (
      !object(options) ||
      (options.limits !== undefined && !object(options.limits)) ||
      (options.flags !== undefined && !object(options.flags)) ||
      typeof read !== "function"
    )
      fail("font-options", "options", "diagnostic.fontOptions");
    for (const [key, value] of Object.entries(options.limits ?? {})) {
      if (
        !Object.hasOwn(defaults, key) ||
        typeof value !== "number" ||
        !Number.isSafeInteger(value) ||
        value < (key === "maxDepth" ? 0 : 1) ||
        value > ceilings[key as keyof FontProviderLimits]
      )
        fail("font-options", `options.limits.${key}`, "diagnostic.fontOptions");
      limits[key as keyof FontProviderLimits] = value;
    }
    const flags: FontFlags = { uniform: false, jp: false };
    for (const [key, value] of Object.entries(options.flags ?? {})) {
      if ((key !== "uniform" && key !== "jp") || typeof value !== "boolean")
        fail("font-options", `options.flags.${key}`, "diagnostic.fontOptions");
      (flags as { uniform: boolean; jp: boolean })[key] = value;
    }
    const signal = options.signal as AbortSignal | undefined;
    if (
      signal !== undefined &&
      (!object(signal) ||
        typeof signal.aborted !== "boolean" ||
        typeof signal.addEventListener !== "function" ||
        typeof signal.removeEventListener !== "function")
    )
      fail("font-options", "options.signal", "diagnostic.fontOptions");
    const cancelled = (path: string) => {
      if (signal?.aborted)
        fail("font-cancelled", path, "diagnostic.fontCancelled");
    };
    const limit = (
      name: keyof FontProviderLimits,
      count: number,
      path: string,
    ) => {
      if (count > limits[name])
        fail("font-limit", path, "diagnostic.fontLimit", { limit: name });
    };
    const root = identifier(fontId, "fontId");
    const definitions = new Map<string, unknown[]>(),
      active = new Set<string>(),
      resources = new Set<string>(),
      fontFiles: string[] = [],
      providers: FontProvider[] = [];
    let totalBytes = 0,
      visits = 0,
      glyphs = 0,
      overrideCount = 0;

    async function load(id: ReturnType<typeof identifier>): Promise<unknown[]> {
      const cached = definitions.get(id.id);
      if (cached) return cached;
      const path = `assets/${id.namespace}/font/${id.path}.json`;
      limit("maxFontFiles", fontFiles.length + 1, path);
      const maxBytes = Math.min(
        limits.maxDefinitionBytes,
        limits.maxTotalBytes - totalBytes,
      );
      if (maxBytes < 1)
        fail("font-limit", path, "diagnostic.fontLimit", {
          limit: "maxTotalBytes",
        });
      cancelled(path);
      let onAbort: (() => void) | undefined, data: Uint8Array | undefined;
      try {
        const pending = Promise.resolve().then(() => {
          cancelled(path);
          return read(path, { maxBytes, signal });
        });
        data = signal
          ? await Promise.race([
              pending,
              new Promise<never>((_resolve, reject) => {
                onAbort = () =>
                  reject(
                    new FontFailure(
                      diagnostic("font-cancelled", path, {
                        key: "diagnostic.fontCancelled",
                      }),
                    ),
                  );
                signal.addEventListener("abort", onAbort, { once: true });
                if (signal.aborted) onAbort();
              }),
            ])
          : await pending;
      } catch (error) {
        if (error instanceof FontFailure) throw error;
        cancelled(path);
        fail("font-read", path, "diagnostic.fontRead");
      } finally {
        if (onAbort) signal?.removeEventListener("abort", onAbort);
      }
      cancelled(path);
      if (data === undefined)
        fail("font-resource-missing", path, "diagnostic.fontResourceMissing");
      if (
        !ArrayBuffer.isView(data) ||
        Object.prototype.toString.call(data) !== "[object Uint8Array]"
      )
        fail("font-read", path, "diagnostic.fontRead");
      limit("maxDefinitionBytes", data.byteLength, path);
      limit("maxTotalBytes", totalBytes + data.byteLength, path);
      totalBytes += data.byteLength;
      let definition: unknown;
      try {
        definition = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(data),
        );
      } catch {
        invalid(path);
      }
      if (!object(definition) || !Array.isArray(definition.providers))
        invalid(path);
      definitions.set(id.id, definition.providers);
      fontFiles.push(path);
      return definition.providers;
    }
    async function visit(
      id: ReturnType<typeof identifier>,
      depth: number,
    ): Promise<void> {
      const filePath = `assets/${id.namespace}/font/${id.path}.json`;
      cancelled(filePath);
      limit("maxDepth", depth, filePath);
      if (active.has(id.id))
        fail("font-reference-cycle", filePath, "diagnostic.fontReferenceCycle");
      active.add(id.id);
      const entries = await load(id);
      for (let index = 0; index < entries.length; index++) {
        const path = `${filePath}.providers[${index}]`,
          entry = entries[index];
        limit("maxProviderVisits", ++visits, path);
        if (!object(entry)) invalid(path);
        let enabled = true;
        if (entry.filter !== undefined) {
          if (!object(entry.filter)) invalid(`${path}.filter`);
          for (const [flag, expected] of Object.entries(entry.filter)) {
            if (
              (flag !== "uniform" && flag !== "jp") ||
              typeof expected !== "boolean"
            )
              invalid(`${path}.filter.${flag}`);
            if (flags[flag] !== expected) enabled = false;
          }
        }
        if (!enabled) continue;
        if (entry.type === "reference") {
          await visit(identifier(entry.id, `${path}.id`), depth + 1);
          continue;
        }
        limit("maxProviders", providers.length + 1, path);
        const source = { fontId: id.id, providerIndex: index };
        let provider: FontProvider;
        if (entry.type === "space") {
          if (!object(entry.advances)) invalid(`${path}.advances`);
          const advances: Record<string, number> = Object.create(null);
          for (const [char, advance] of Object.entries(entry.advances)) {
            limit("maxGlyphs", ++glyphs, path);
            if (
              !scalar(char) ||
              typeof advance !== "number" ||
              !Number.isFinite(Math.fround(advance))
            )
              invalid(`${path}.advances`);
            advances[char] = Math.fround(advance);
          }
          provider = { ...source, type: "space", advances };
        } else if (entry.type === "bitmap") {
          const file = identifier(entry.file, `${path}.file`),
            height = entry.height === undefined ? 8 : entry.height;
          if (
            !integer(height) ||
            !integer(entry.ascent) ||
            entry.ascent > height ||
            !Array.isArray(entry.chars) ||
            entry.chars.length === 0
          )
            invalid(path);
          let columns: number | undefined;
          const chars: string[] = [];
          for (const row of entry.chars) {
            if (typeof row !== "string") invalid(`${path}.chars`);
            const codepoints = [...row];
            if (
              codepoints.length === 0 ||
              (columns !== undefined && codepoints.length !== columns)
            )
              invalid(`${path}.chars`);
            limit("maxGlyphs", (glyphs += codepoints.length), path);
            if (!codepoints.every(scalar)) invalid(`${path}.chars`);
            columns = codepoints.length;
            chars.push(row);
          }
          provider = {
            ...source,
            type: "bitmap",
            file: file.id,
            resourcePath: `assets/${file.namespace}/textures/${file.path}`,
            height,
            ascent: entry.ascent,
            chars,
          };
        } else if (entry.type === "unihex") {
          const file = identifier(entry.hex_file, `${path}.hex_file`),
            overrides =
              entry.size_overrides === undefined ? [] : entry.size_overrides;
          if (!Array.isArray(overrides)) invalid(`${path}.size_overrides`);
          limit("maxOverrides", (overrideCount += overrides.length), path);
          const sizeOverrides = overrides.map((range: unknown) => {
            if (
              !object(range) ||
              !scalar(range.from) ||
              !scalar(range.to) ||
              !integer(range.left) ||
              !integer(range.right)
            )
              return invalid(`${path}.size_overrides`);
            const from = range.from.codePointAt(0)!,
              to = range.to.codePointAt(0)!;
            if (from >= to) invalid(`${path}.size_overrides`);
            return { from, to, left: range.left, right: range.right };
          });
          provider = {
            ...source,
            type: "unihex",
            hexFile: file.id,
            resourcePath: `assets/${file.namespace}/${file.path}`,
            sizeOverrides,
          };
        } else
          fail(
            "font-provider-unsupported",
            path,
            "diagnostic.fontProviderUnsupported",
          );
        providers.push(provider);
        if (provider.type !== "space") resources.add(provider.resourcePath);
      }
      active.delete(id.id);
    }
    await visit(root, 0);
    cancelled("fontId");
    return {
      value: freeze({
        schemaVersion: 1,
        fontId: root.id,
        flags,
        providers,
        resources: [...resources],
        fontFiles,
      }),
      diagnostics: [],
    };
  } catch (error) {
    if (error instanceof FontFailure)
      return { value: null, diagnostics: [error.detail] };
    return {
      value: null,
      diagnostics: [
        diagnostic("font-options", "options", {
          key: "diagnostic.fontOptions",
        }),
      ],
    };
  }
}
