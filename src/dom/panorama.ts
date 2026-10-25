import type { PreviewContext } from "../core/model.js";
import {
  panoramaPose,
  resolvePanorama,
  type ResolvedPanorama,
} from "../core/panorama.js";
import { createPanoramaSurface } from "./panorama-renderer.js";

/** One decorative cube/resource lifecycle per existing entry mount. */
export function createPanorama(backdrop: HTMLElement) {
  const doc = backdrop.ownerDocument;
  let settings: ResolvedPanorama | null = null,
    generation = 0,
    destroyed = false,
    width = 0,
    height = 0,
    scale = 1,
    phaseMs = 0,
    lastFrameAt: number | undefined,
    frameId: number | undefined,
    animationsEnabled = false,
    viewport: HTMLElement | undefined,
    render: HTMLElement | undefined,
    surface: ReturnType<typeof createPanoramaSurface>,
    dimmer: HTMLElement | undefined,
    overlayUrl: string | undefined,
    cancelLoading = () => {},
    cancelOverlay = () => {};
  const view = doc.defaultView,
    reducedMotion = view?.matchMedia("(prefers-reduced-motion: reduce)");
  backdrop.setAttribute("aria-hidden", "true");
  const element = (className: string) => {
    const node = doc.createElement("div");
    node.className = className;
    return node;
  };
  function clear() {
    generation++;
    stopFrame();
    cancelLoading();
    cancelLoading = () => {};
    cancelOverlay();
    cancelOverlay = () => {};
    overlayUrl = undefined;
    surface?.destroy();
    surface = null;
    viewport?.remove();
    viewport = render = dimmer = undefined;
  }
  function paint() {
    if (!settings || !render || !surface || !dimmer) return false;
    const pose = panoramaPose(phaseMs, settings.initialYaw),
      blur = settings.blur / scale;
    try {
      if (!surface.draw(pose, width, height, scale, blur))
        throw new Error("Panorama unavailable");
    } catch {
      clear();
      backdrop.dataset.panoramaState = "failed";
      return false;
    }
    render.style.inset = -blur * 3 + "px";
    if (blur) render.style.filter = `blur(${blur}px)`;
    else render.style.removeProperty("filter");
    dimmer.style.background = `rgba(0,0,0,${settings.dimming})`;
    if (overlayUrl !== settings.source.overlayImageUrl) {
      cancelOverlay();
      overlayUrl = settings.source.overlayImageUrl;
      if (overlayUrl) {
        const image = doc.createElement("img");
        image.alt = "";
        image.draggable = false;
        image.className = "mcp-panorama-overlay";
        const failed = () => image.remove();
        image.addEventListener("error", failed, { once: true });
        image.src = overlayUrl;
        render.append(image);
        cancelOverlay = () => {
          image.removeEventListener("error", failed);
          image.removeAttribute("src");
          image.remove();
        };
      } else cancelOverlay = () => {};
    }
    return true;
  }
  function canAnimate() {
    return !!(
      !destroyed &&
      settings &&
      render &&
      animationsEnabled &&
      !settings.paused &&
      settings.speed !== 0 &&
      !reducedMotion?.matches &&
      !doc.hidden &&
      view
    );
  }
  function stopFrame() {
    if (frameId !== undefined) view?.cancelAnimationFrame(frameId);
    frameId = undefined;
    lastFrameAt = undefined;
  }
  function animate(timestamp: number) {
    frameId = undefined;
    if (!canAnimate()) {
      lastFrameAt = undefined;
      return;
    }
    if (lastFrameAt !== undefined && Number.isFinite(timestamp))
      phaseMs += (timestamp - lastFrameAt) * settings!.speed;
    lastFrameAt = timestamp;
    if (!paint()) return;
    frameId = view!.requestAnimationFrame(animate);
  }
  function syncAnimation() {
    if (!canAnimate()) {
      stopFrame();
      return;
    }
    if (frameId === undefined) {
      lastFrameAt = undefined;
      frameId = view!.requestAnimationFrame(animate);
    }
  }
  const onDocumentVisibility = () => syncAnimation(),
    onReducedMotionChange = () => syncAnimation();
  doc.addEventListener("visibilitychange", onDocumentVisibility);
  reducedMotion?.addEventListener("change", onReducedMotionChange);
  function load() {
    clear();
    phaseMs = 0;
    if (!settings) return;
    const current = generation,
      images = settings.source.faces.map(() => doc.createElement("img"));
    let loaded = 0;
    const valid = () => !destroyed && current === generation;
    function cleanup(abort: boolean) {
      for (const image of images) {
        image.removeEventListener("load", ready);
        image.removeEventListener("error", failed);
        if (abort) image.removeAttribute("src");
      }
    }
    function failed() {
      if (!valid()) return;
      cleanup(true);
      clear();
      backdrop.dataset.panoramaState = "failed";
    }
    function ready() {
      if (!valid() || ++loaded !== 6) return;
      const faceSize = images[0]!.naturalWidth;
      if (
        !faceSize ||
        faceSize > 2048 ||
        images.some(
          (image) =>
            image.naturalWidth !== faceSize || image.naturalHeight !== faceSize,
        )
      ) {
        failed();
        return;
      }
      cleanup(false);
      cancelLoading = () => {};
      try {
        surface = createPanoramaSurface(
          doc,
          images,
          settings!.source.faces,
          failed,
        );
      } catch {
        failed();
        return;
      }
      if (!surface) {
        failed();
        return;
      }
      viewport = element("mcp-panorama-viewport");
      render = element("mcp-panorama-render");
      dimmer = element("mcp-panorama-dimmer");
      surface.canvas.className = "mcp-panorama-canvas";
      surface.canvas.setAttribute("aria-hidden", "true");
      render.append(surface.canvas);
      viewport.append(render, dimmer);
      backdrop.append(viewport);
      backdrop.dataset.panoramaState = "ready";
      if (paint()) syncAnimation();
    }
    backdrop.dataset.panoramaState = "loading";
    cancelLoading = () => cleanup(true);
    images.forEach((image, index) => {
      image.addEventListener("load", ready);
      image.addEventListener("error", failed);
      image.crossOrigin = "anonymous";
      image.src = settings!.source.faces[index]!;
    });
  }
  return {
    update(
      background: unknown,
      context: PreviewContext,
      size: { width: number; height: number },
    ) {
      if (destroyed) return;
      width = size.width;
      height = size.height;
      scale = Math.max(0.5, context.guiScale);
      animationsEnabled = context.animations;
      const next = resolvePanorama(background);
      if (!next) {
        settings = null;
        clear();
        delete backdrop.dataset.panoramaState;
        if (
          background &&
          typeof background === "object" &&
          "panorama" in background
        ) {
          backdrop.style.backgroundImage = "";
          backdrop.dataset.panoramaState = "failed";
        }
        syncAnimation();
        return;
      }
      const changed =
        !settings ||
        next.source.faces.some(
          (url, index) => url !== settings!.source.faces[index],
        );
      settings = next;
      backdrop.style.backgroundImage = settings.source.fallbackImageUrl
        ? `url(${JSON.stringify(settings.source.fallbackImageUrl)}),var(--mcp-panorama-fallback)`
        : "";
      if (changed || backdrop.dataset.panoramaState === "failed") load();
      else {
        paint();
        syncAnimation();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      settings = null;
      clear();
      doc.removeEventListener("visibilitychange", onDocumentVisibility);
      reducedMotion?.removeEventListener("change", onReducedMotionChange);
    },
  };
}
