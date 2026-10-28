import type { FontGlyphSource, FontSourceGlyph } from "../fonts/source.js";

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface Diagnostic {
  code: string;
  severity: "error" | "warning";
  path: string;
  message: string;
  /** Stable translation key; message remains the English compatibility fallback. */
  messageKey?: string;
  parameters?: Readonly<Record<string, string | number>>;
  range?: { start: number; end: number };
}
export interface Outcome<T> {
  value: T | null;
  diagnostics: Diagnostic[];
}
export type TextFormat =
  "minimessage" | "legacy-ampersand" | "legacy-section" | "properties" | "json";
export interface GradientStop {
  color: string;
  position: number;
}
export interface TextStyle {
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
  gradient?: GradientStop[];
  gradientPhase?: number;
  rainbow?: { phase: number; reversed: boolean };
}
interface NodeBase {
  id: string;
}
export type TextNode =
  | (NodeBase & { type: "text"; value: string })
  | (NodeBase & { type: "group"; style: TextStyle; children: TextNode[] })
  | (NodeBase & { type: "newline" })
  | (NodeBase & { type: "placeholder"; name: string })
  | (NodeBase & {
      type: "opaque";
      raw: string;
      format: TextFormat;
      fallback?: string;
    });
export interface TextDocument {
  revision: number;
  nodes: TextNode[];
  source?: { format: TextFormat; value: string; revision: number };
}
export type Alignment = "left" | "center" | "right";
export type VersionRule =
  | { mode: "automatic" }
  | { mode: "when-incompatible" | "always"; text: TextDocument };
export type CountRule =
  | { mode: "inherit" }
  | { mode: "fixed" | "offset" | "percent" | "headroom"; value: number };
export interface PlayerRules {
  hidden: boolean;
  online: CountRule;
  maximum: CountRule;
}
export type HoverRule =
  { mode: "inherit" | "disabled" } | { mode: "custom"; text: TextDocument };
export interface IconValue {
  pngBase64: string;
}
export interface ServerListDocument {
  schemaVersion: 1;
  motd: { text: TextDocument; alignments: Alignment[] };
  version: VersionRule;
  icon: IconValue | null;
  players: PlayerRules;
  hover: HoverRule;
  extensions: Record<string, JsonValue>;
}
export interface JavaStatus {
  version: { protocol: number; name: string };
  players?: {
    online: number;
    max: number;
    sample: { name: string; id: string }[];
  };
  description: JsonValue;
  favicon?: string;
}
export interface RuntimeContext {
  base: JavaStatus;
  clientProtocol: number;
  compatible?: boolean;
  values: Readonly<Record<string, string>>;
  /** Profile and logical width used when materializing aligned MOTD output. */
  motdLayout?: Pick<LayoutOptions, "profile" | "width" | "fontSource">;
}
export interface FontProfile {
  /** Explicit CPU geometry supported by the optional imported-font viewer. */
  runtimeGlyphGeometry?: "java-26.3";
  /** Native ASCII-space wrapping with LTR grapheme metrics; omission keeps legacy wrapping. */
  layout?: "java-ltr";
  family: string;
  advances: Readonly<Record<string, number>>;
  fallbackAdvance: number;
  boldOffset: number;
  lineHeight: number;
  supported: (glyph: string) => boolean;
}
export interface ClientProfile {
  id: string;
  clientVersion: string;
  /** Native status protocol, when known. Custom profiles may omit this. */
  protocol?: number;
  background?: "dirt" | "panorama";
  verified: boolean;
  font: FontProfile;
  geometry: {
    rowWidth: number;
    contentWidth?: number;
    rowTop?: number;
    titleTop?: number;
    listTop?: number;
    /** Legacy list-edge fade height in logical GUI pixels. */
    listFade?: number;
    selectionCenterRounding?: "floor";
    footerHeight?: number;
    footerBottom?: number;
    iconSize: number;
    iconGap: number;
    rightInset: number;
    /** Logical gap between status text and the right edge of entry content. */
    statusRight?: number;
    /** Draw a one-pixel, quarter-brightness MOTD shadow (modern Java menu). */
    motdShadow?: boolean;
    lineHeight: number;
  };
}
/** Supplied by a host application; asset URLs are never persisted in the server document. */
export interface PanoramaSource {
  /** Native panorama_0 through panorama_5 order: front, right, back, left, top, bottom. */
  faces: readonly [string, string, string, string, string, string];
  fallbackImageUrl?: string;
  overlayImageUrl?: string;
}
export interface PanoramaMotion {
  /** Initial native camera heading in degrees; changing it offsets the current phase. */
  initialYaw?: number;
  /** Native-speed multiplier, bounded to [-10,10]. Negative values reverse playback. */
  speed?: number;
  paused?: boolean;
}
export interface PanoramaBackground {
  panorama: PanoramaSource;
  motion?: PanoramaMotion;
  /** Blur radius in CSS pixels, independent of GUI scale. Default 5; maximum 32. */
  blur?: number;
  /** Black overlay opacity in [0,1]. Default 1/3. */
  dimming?: number;
}
export interface PanoramaPose {
  yaw: number;
  pitch: number;
  verticalFov: number;
}
export type PreviewBackground =
  | "auto"
  | "dirt"
  | "panorama"
  | "none"
  | { imageUrl: string }
  | PanoramaBackground;
export interface ClientAssets {
  background?: Exclude<PreviewBackground, "auto">;
  defaultServerIcon?: string;
  fontFamily?: string;
  buttons?: { normal: string; disabled?: string; border?: number };
}
export type ClientAssetProvider = (
  profile: ClientProfile,
) => ClientAssets | undefined;
export interface PreviewContext extends RuntimeContext {
  profile: ClientProfile;
  viewportWidth: number;
  /** Physical preview height. Defaults to 180 logical GUI pixels. */
  viewportHeight?: number;
  presentation?: "server-list" | "row";
  background?: PreviewBackground;
  assetProvider?: ClientAssetProvider;
  selected?: boolean;
  guiScale: number;
  serverName: string;
  pingMs: number;
  animations: boolean;
}
export interface ParseOptions {
  maxTextLength?: number;
  maxDepth?: number;
}
export interface TextTarget {
  format: TextFormat;
  rgb?: boolean;
  hex?: "bukkit" | "adventure";
  encoding?: "utf8" | "ascii";
}
export interface SerializeOptions {
  lossy?: "reject" | "reduce";
  layout?: LayoutOptions;
}
export interface LayoutOptions {
  profile: ClientProfile;
  /** Explicit runtime source; selects scalar metrics without changing the document. */
  fontSource?: FontGlyphSource;
  /** Optional draw-time candidate selection; deterministic layout omits this. */
  obfuscationRandom?: () => number;
  width: number;
  maxLines?: number;
  alignments?: Alignment[];
}
export interface Glyph {
  /** Selected runtime metadata, shared with visible ink. Absent for a missing source glyph. */
  fontGlyph?: FontSourceGlyph;
  /** Source space consumed at a native soft break; retained for editor/source mapping. */
  suppressed?: boolean;
  text: string;
  color: string;
  style: TextStyle;
  advance: number;
  x: number;
  line: number;
  nodeId: string;
  offset: number;
  position: number;
}
export interface LayoutResult {
  glyphs: Glyph[];
  lines: {
    width: number;
    padding: number;
    /** Exact synthesized space count for runtime float32 alignment. */ spaceCount?: number;
  }[];
  diagnostics: Diagnostic[];
}
export type StatusTemplate = Omit<ServerListDocument, "extensions">;
