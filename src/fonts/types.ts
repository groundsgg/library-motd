/** The host owns local resource selection and must bound reads before allocation. */
export type FontResourceReader = (
  path: string,
  request: { readonly maxBytes: number; readonly signal?: AbortSignal },
) => Uint8Array | undefined | Promise<Uint8Array | undefined>;

export interface FontFlags {
  readonly uniform: boolean;
  readonly jp: boolean;
}
export interface FontProviderLimits {
  maxFontFiles: number;
  maxDefinitionBytes: number;
  maxTotalBytes: number;
  maxDepth: number;
  maxProviderVisits: number;
  maxProviders: number;
  maxGlyphs: number;
  maxOverrides: number;
}
export interface FontProviderOptions {
  flags?: Partial<FontFlags>;
  limits?: Partial<FontProviderLimits>;
  signal?: AbortSignal;
}
interface Source {
  readonly fontId: string;
  readonly providerIndex: number;
}
export interface UnihexSizeOverride {
  readonly from: number;
  readonly to: number;
  readonly left: number;
  readonly right: number;
}
export type FontProvider = Source &
  (
    | {
        readonly type: "space";
        readonly advances: Readonly<Record<string, number>>;
      }
    | {
        readonly type: "bitmap";
        readonly file: string;
        readonly resourcePath: string;
        readonly height: number;
        readonly ascent: number;
        readonly chars: readonly string[];
      }
    | {
        readonly type: "unihex";
        readonly hexFile: string;
        readonly resourcePath: string;
        readonly sizeOverrides: readonly UnihexSizeOverride[];
      }
  );
/** Metadata only: this is not a renderable FontProfile or a decoded font. */
export interface FontProviderGraph {
  readonly schemaVersion: 1;
  readonly fontId: string;
  readonly flags: FontFlags;
  readonly providers: readonly FontProvider[];
  readonly resources: readonly string[];
  readonly fontFiles: readonly string[];
}
