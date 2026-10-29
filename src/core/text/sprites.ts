import type { AtlasSprite } from "../model.js";
/** Resource identifiers, never URLs; a host decides which resources exist. */
export function spriteResourceId(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 256) return null;
  const id = value.includes(":") ? value : `minecraft:${value}`;
  return !id.includes("://") &&
    !id.includes("//") &&
    !id.split(":")[1]?.startsWith("/") &&
    /^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(id) &&
    !id
      .split(":")[1]!
      .split("/")
      .some((p) => p === "." || p === "..")
    ? id
    : null;
}
export function parseSpriteTag(body: string): AtlasSprite | null {
  const args: string[] = [];
  const source = body.endsWith("/") ? body.slice(0, -1) : body;
  let value = "",
    quote = "";
  for (let i = 0; i < source.length; i++) {
    const c = source[i]!;
    if (quote) {
      if (c === "\\" && [quote, "\\"].includes(source[i + 1] ?? ""))
        value += source[++i];
      else if (c === quote) quote = "";
      else value += c;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ":") {
      args.push(value);
      value = "";
    } else value += c;
  }
  if (quote) return null;
  args.push(value);
  if (
    args.shift()?.toLowerCase() !== "sprite" ||
    (args.length !== 1 && args.length !== 2)
  )
    return null;
  const atlas = spriteResourceId(
    args.length === 1 ? "minecraft:blocks" : args[0],
  );
  const sprite = spriteResourceId(args.at(-1));
  return atlas && sprite ? { atlas, sprite } : null;
}
export function spriteTag(sprite: AtlasSprite): string {
  return `<sprite:"${sprite.atlas}":"${sprite.sprite}">`;
}
