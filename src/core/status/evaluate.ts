import type {
  CountRule,
  Diagnostic,
  JavaStatus,
  Outcome,
  RuntimeContext,
  ServerListDocument,
  TextDocument,
  TextTarget,
} from "../model.js";
import { java1211Profile } from "../../profiles/java-1.21.1.js";
import { validateDocument } from "../document.js";
import { diagnostic } from "../diagnostics.js";
import { resolveText } from "../text/placeholders.js";
import { serializeText, serializeLegacyLines } from "../text/serialize.js";
export function evaluatePlayerCounts(
  document: ServerListDocument,
  context: RuntimeContext,
): Outcome<{ online?: number; max?: number }> {
  const diagnostics: Diagnostic[] = [];
  const count = (
    rule: CountRule,
    base: number | undefined,
    online?: number,
  ): number | undefined => {
    if (rule.mode === "inherit") return base;
    const input = rule.mode === "headroom" ? online : base;
    if (rule.mode !== "fixed" && input === undefined) {
      diagnostics.push(
        diagnostic(
          "missing-players",
          "players",
          "A calculation requires missing base player data",
        ),
      );
      return undefined;
    }
    const n =
      rule.mode === "fixed"
        ? rule.value
        : rule.mode === "headroom"
          ? input! + rule.value
          : rule.mode === "percent"
            ? Math.ceil((input! * rule.value) / 100)
            : input! + rule.value;
    const bounded = Math.max(0, Math.min(2147483647, n));
    if (n !== bounded)
      diagnostics.push(
        diagnostic(
          "count-clamped",
          "players",
          "Player count was clamped to the supported integer range",
          "warning",
        ),
      );
    return bounded;
  };
  const online = count(document.players.online, context.base.players?.online),
    max = count(document.players.maximum, context.base.players?.max, online);
  return {
    value: diagnostics.some((d) => d.severity === "error")
      ? null
      : { online, max },
    diagnostics,
  };
}
export function evaluateStatus(
  document: ServerListDocument,
  context: RuntimeContext,
): Outcome<JavaStatus> {
  const valid = validateDocument(document);
  if (!valid.value) return { value: null, diagnostics: valid.diagnostics };
  const counts = evaluatePlayerCounts(document, context);
  if (!counts.value) return { value: null, diagnostics: counts.diagnostics };
  const { online, max } = counts.value;
  const diagnostics = [...counts.diagnostics];
  const values = {
    ...context.values,
    ...(online !== undefined ? { players: String(online) } : {}),
    ...(max !== undefined ? { max: String(max) } : {}),
  };
  const output = (text: TextDocument, target: TextTarget): string | null => {
    const resolved = resolveText(text, values);
    diagnostics.push(...resolved.diagnostics);
    const serialized = serializeText(resolved.value!, target, {
      ...(target.format === "legacy-section"
        ? { lossy: "reduce" as const }
        : {}),
      ...(text === document.motd.text &&
      document.motd.alignments.some((a) => a !== "left")
        ? {
            layout: {
              profile: java1211Profile,
              width: 271,
              maxLines: 2,
              alignments: document.motd.alignments,
            },
          }
        : {}),
    });
    diagnostics.push(...serialized.diagnostics);
    return serialized.value;
  };
  const description = output(document.motd.text, { format: "json", rgb: true });
  const status: JavaStatus = {
    ...structuredClone(context.base),
    description: description ? JSON.parse(description) : "",
  };
  const compatible =
    context.compatible ??
    context.clientProtocol === context.base.version.protocol;
  const customVersion =
    document.version.mode !== "automatic" &&
    (document.version.mode === "always" || !compatible);
  if (customVersion && document.version.mode !== "automatic") {
    const name = output(document.version.text, {
      format: "legacy-section",
      rgb: false,
    });
    if (name !== null)
      status.version = {
        protocol: context.clientProtocol === -1 ? -2 : -1,
        name,
      };
  }
  if (document.icon)
    status.favicon = "data:image/png;base64," + document.icon.pngBase64;
  if (document.players.hidden) {
    delete status.players;
    if (document.hover.mode === "custom")
      diagnostics.push(
        diagnostic(
          "hidden-hover",
          "hover",
          "Hidden player data has no player-list hover",
          "warning",
        ),
      );
  } else if (online !== undefined && max !== undefined) {
    status.players = {
      online,
      max,
      sample: structuredClone(context.base.players?.sample ?? []),
    };
    if (document.hover.mode === "disabled") status.players.sample = [];
    if (document.hover.mode === "custom") {
      const resolved = resolveText(document.hover.text, values);
      diagnostics.push(...resolved.diagnostics);
      const hover = serializeLegacyLines(
        resolved.value!,
        { format: "legacy-section", rgb: false },
        { lossy: "reduce" },
      );
      diagnostics.push(...hover.diagnostics);
      if (hover.value)
        status.players.sample = hover.value.map((name) => ({
          name,
          id: "00000000-0000-0000-0000-000000000000",
        }));
      if (customVersion)
        diagnostics.push(
          diagnostic(
            "unreachable-hover",
            "hover",
            "The incompatible status replaces the player-count hover target",
            "warning",
          ),
        );
    }
  }
  if (diagnostics.some((d) => d.severity === "error"))
    return { value: null, diagnostics };
  return { value: status, diagnostics };
}
