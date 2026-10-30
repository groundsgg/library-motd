/** Shared frame ownership within one painter; decoded retention is pixel-bounded. */
export interface SpriteImage {
  image: HTMLImageElement;
  references: number;
  pixels: number;
  raster?: ImageData;
  state: "loading" | "ready" | "failed";
  listeners: Set<() => void>;
}
export class SpriteImages {
  private readonly entries = new Map<string, SpriteImage>();
  private pixels = 0;
  constructor(private readonly doc: Document) {}
  private remove(key: string, entry: SpriteImage): void {
    if (this.entries.get(key) !== entry) return;
    this.entries.delete(key);
    this.pixels -= entry.pixels;
    entry.pixels = 0;
    entry.raster = undefined;
    entry.image.onload = entry.image.onerror = null;
    entry.image.removeAttribute("src");
  }
  private space(pixels: number, count: number): boolean {
    for (const [key, entry] of this.entries) {
      if (this.pixels + pixels <= 4_194_304 && this.entries.size + count <= 64)
        break;
      if (!entry.references) this.remove(key, entry);
    }
    return this.pixels + pixels <= 4_194_304 && this.entries.size + count <= 64;
  }
  acquire(url: string): SpriteImage | null {
    const previous = this.entries.get(url);
    if (previous) {
      previous.references++;
      return previous;
    }
    if (!this.space(0, 1)) return null;
    const image = this.doc.createElement("img"),
      entry: SpriteImage = {
        image,
        references: 1,
        pixels: 0,
        state: "loading",
        listeners: new Set(),
      };
    this.entries.set(url, entry);
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    const finish = (ok: boolean) => {
      if (entry.state !== "loading") return;
      const pixels = image.naturalWidth * image.naturalHeight;
      if (
        !ok ||
        !image.naturalWidth ||
        image.naturalWidth !== image.naturalHeight ||
        image.naturalWidth > 1024 ||
        !this.space(pixels, 0)
      ) {
        entry.state = "failed";
        this.remove(url, entry);
      } else {
        entry.pixels = pixels;
        this.pixels += pixels;
        entry.state = "ready";
        image.onload = image.onerror = null;
      }
      for (const listener of [...entry.listeners]) listener();
    };
    image.onload = () => finish(true);
    image.onerror = () => finish(false);
    image.src = url;
    return entry;
  }
  release(entry: SpriteImage): void {
    entry.references = Math.max(0, entry.references - 1);
    if (entry.state === "loading" && !entry.references)
      queueMicrotask(() => {
        if (entry.state !== "loading" || entry.references) return;
        for (const [key, value] of this.entries)
          if (value === entry) {
            entry.state = "failed";
            this.remove(key, entry);
            break;
          }
      });
  }
  /** One original-resolution RGBA copy per retained frame, evicted with its image. */
  raster(entry: SpriteImage): ImageData {
    if (entry.raster) return entry.raster;
    const canvas = this.doc.createElement("canvas");
    canvas.width = entry.image.naturalWidth;
    canvas.height = entry.image.naturalHeight;
    try {
      const g = canvas.getContext("2d", { willReadFrequently: true });
      if (!g) throw new Error("Sprite pixel context unavailable");
      g.drawImage(entry.image, 0, 0);
      entry.raster = g.getImageData(0, 0, canvas.width, canvas.height);
      return entry.raster;
    } finally {
      canvas.width = canvas.height = 0;
    }
  }
  destroy(): void {
    for (const [key, entry] of this.entries) {
      entry.state = "failed";
      this.remove(key, entry);
      entry.listeners.clear();
    }
  }
}
