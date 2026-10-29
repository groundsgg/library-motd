import { SpriteImages, type SpriteImage } from "./sprite-images.js";
import type {
  Diagnostic,
  Glyph,
  PreviewContext,
  SpriteAsset,
} from "../core/model.js";
import { diagnostic } from "../core/diagnostics.js";

const epochs = new WeakMap<Document, number>();
/** A bounded owner for image loads, native tick playback and their cancellation. */
export class SpritePainter {
  private readonly images: SpriteImages;
  private disposers: (() => void)[] = [];
  readonly diagnostics: Diagnostic[] = [];
  constructor(
    private readonly doc: Document,
    private readonly changed?: () => void,
  ) {
    this.images = new SpriteImages(doc);
  }
  clear(): void {
    this.disposers.splice(0).forEach((dispose) => dispose());
    this.diagnostics.length = 0;
  }
  paint(
    span: HTMLElement,
    glyph: Pick<Glyph, "sprite" | "style" | "color" | "advance">,
    context: PreviewContext,
  ): void {
    const sprite = glyph.sprite!,
      win = this.doc.defaultView;
    span.classList.add("mcp-sprite");
    span.dataset.sprite = sprite.sprite;
    span.textContent = "";
    span.style.width = glyph.advance + "px";
    span.style.fontSize = "0";
    span.style.textShadow = "none";
    span.title = `${sprite.atlas} / ${sprite.sprite}`;
    span.setAttribute("role", "img");
    span.setAttribute("aria-label", span.title);
    if (!context.profile.atlasSprites || !win) {
      span.dataset.spriteState = "unsupported";
      return;
    }
    const canvas = this.doc.createElement("canvas");
    canvas.width = canvas.height = 9;
    canvas.setAttribute("aria-hidden", "true");
    span.append(canvas);
    const g = canvas.getContext("2d"),
      reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    if (!g) return;
    let disposed = false,
      raf: number | undefined,
      images: HTMLImageElement[] = [],
      asset: SpriteAsset | undefined,
      releaseFrames = () => {};
    const fail = (missing = false) => {
      if (disposed || span.dataset.spriteState === "failed") return;
      span.dataset.spriteState = "failed";
      releaseFrames();
      if (raf !== undefined) win.cancelAnimationFrame(raf);
      raf = undefined;
      g.clearRect(0, 0, 9, 9);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          g.fillStyle =
            (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? "#000000" : "#ff00ff";
          g.fillRect(x, y, 1, 1);
        }
      this.diagnostics.push(
        diagnostic(
          missing ? "sprite-resource-missing" : "sprite-resource-invalid",
          "motd",
          missing
            ? {
                key: "diagnostic.spriteResourceMissing",
                parameters: { sprite: sprite.sprite },
              }
            : { key: "diagnostic.spriteResourceInvalid" },
          "warning",
        ),
      );
      this.changed?.();
    };
    const loadDisposers: (() => void)[] = [];
    const dispose = () => {
      disposed = true;
      if (raf !== undefined) win.cancelAnimationFrame(raf);
      reduced.removeEventListener("change", sync);
      releaseFrames();
    };
    this.disposers.push(dispose);
    try {
      asset = context.spriteProvider?.(sprite, context.profile);
    } catch {
      fail();
      return;
    }
    const safeUrl = (url: unknown) => {
      if (typeof url !== "string" || url.length > 2_000_000) return false;
      try {
        const parsed = new URL(url, this.doc.baseURI);
        return (
          ["http:", "https:", "blob:"].includes(parsed.protocol) ||
          (parsed.protocol === "data:" &&
            /^data:image\/(png|jpeg|webp|svg\+xml)[;,]/i.test(url))
        );
      } catch {
        return false;
      }
    };
    if (!asset) {
      fail(true);
      return;
    }
    if (
      !Array.isArray(asset.frames) ||
      !asset.frames.length ||
      asset.frames.length > 64 ||
      asset.frames.some(
        (f) =>
          !f ||
          !safeUrl(f.url) ||
          !Number.isInteger(f.ticks ?? 1) ||
          (f.ticks ?? 1) < 1 ||
          (f.ticks ?? 1) > 12000,
      )
    ) {
      fail();
      return;
    }
    const frames = asset.frames.map((f) => ({
        url: f.url,
        ticks: f.ticks ?? 1,
      })),
      total = frames.reduce((n, f) => n + f.ticks, 0);
    let loaded = 0,
      last = -1;
    const source = this.doc.createElement("canvas");
    source.width = source.height = 8;
    const sourceContext = source.getContext("2d", { willReadFrequently: true });
    const now = () => win.performance.now();
    if (!epochs.has(this.doc)) epochs.set(this.doc, now());
    const epoch = epochs.get(this.doc)!;
    function frameAt(time: number) {
      let phase = ((time - epoch) / 50) % total;
      for (let i = 0; i < frames.length; i++) {
        if (phase < frames[i]!.ticks) return i;
        phase -= frames[i]!.ticks;
      }
      return 0;
    }
    const draw = (index: number) => {
      if (disposed || index === last || !sourceContext) return;
      try {
        sourceContext.clearRect(0, 0, 8, 8);
        sourceContext.imageSmoothingEnabled = false;
        sourceContext.drawImage(images[index]!, 0, 0, 8, 8);
        const pixels = sourceContext.getImageData(0, 0, 8, 8),
          output = g.createImageData(9, 9);
        const rgb = [1, 3, 5].map((i) =>
          parseInt(glyph.color.slice(i, i + 2), 16),
        );
        const argb = glyph.style.shadowColor,
          shadow =
            argb === undefined
              ? rgb.map((c) => Math.floor(c / 4))
              : [(argb >>> 16) & 255, (argb >>> 8) & 255, argb & 255];
        const shadowAlpha = argb === undefined ? 255 : argb >>> 24;
        const over = (x: number, y: number, color: number[], alpha: number) => {
          if (alpha < 25.5) return;
          const at = (y * 9 + x) * 4,
            a = alpha / 255,
            old = output.data[at + 3]! / 255,
            combined = a + old * (1 - a);
          for (let c = 0; c < 3; c++)
            output.data[at + c] = combined
              ? (color[c]! * a + output.data[at + c]! * old * (1 - a)) /
                combined
              : 0;
          output.data[at + 3] = combined * 255;
        };
        if (context.profile.geometry.motdShadow && shadowAlpha)
          for (let y = 0; y < 8; y++)
            for (let x = 0; x < 8; x++)
              over(
                x + 1,
                y + 1,
                shadow.map(
                  (c, i) => (pixels.data[(y * 8 + x) * 4 + i]! * c) / 255,
                ),
                (pixels.data[(y * 8 + x) * 4 + 3]! * shadowAlpha) / 255,
              );
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const at = (y * 8 + x) * 4;
            over(
              x,
              y,
              rgb.map((c, i) => (pixels.data[at + i]! * c) / 255),
              pixels.data[at + 3]!,
            );
          }
        g.putImageData(output, 0, 0);
        last = index;
        canvas.dataset.spriteFrame = String(index);
      } catch {
        fail();
      }
    };
    const tick = (time: number) => {
      raf = undefined;
      if (disposed || span.dataset.spriteState !== "ready") return;
      draw(frameAt(time));
      raf = win.requestAnimationFrame(tick);
    };
    function sync() {
      if (raf !== undefined) win!.cancelAnimationFrame(raf);
      raf = undefined;
      last = -1;
      if (
        disposed ||
        loaded !== frames.length ||
        span.dataset.spriteState !== "ready"
      )
        return;
      const moving =
        context.animations && !reduced.matches && frames.length > 1;
      draw(moving ? frameAt(now()) : 0);
      if (moving) raf = win!.requestAnimationFrame(tick);
    }
    reduced.addEventListener("change", sync);
    span.dataset.spriteState = "loading";
    const acquired: SpriteImage[] = [];
    releaseFrames = () => {
      loadDisposers.splice(0).forEach((fn) => fn());
      acquired.splice(0).forEach((entry) => this.images.release(entry));
    };
    for (const frame of frames) {
      const entry = this.images.acquire(frame.url);
      if (!entry) {
        fail();
        return;
      }
      acquired.push(entry);
    }
    images = acquired.map((entry) => entry.image);
    for (const entry of acquired) {
      let settled = false;
      const ready = () => {
        if (
          settled ||
          disposed ||
          span.dataset.spriteState === "failed" ||
          entry.state === "loading"
        )
          return;
        settled = true;
        if (entry.state === "failed") {
          fail();
          return;
        }
        if (++loaded === frames.length) {
          span.dataset.spriteState = "ready";
          sync();
        }
      };
      entry.listeners.add(ready);
      loadDisposers.push(() => entry.listeners.delete(ready));
      queueMicrotask(ready);
    }
  }

  destroy(): void {
    this.clear();
    this.images.destroy();
  }
}
