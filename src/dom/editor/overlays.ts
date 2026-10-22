export type OverlayClose =
  "dismiss" | "cancel" | "apply" | "replace" | "destroy";
interface OverlayOptions {
  id: string;
  label: string;
  anchor: HTMLElement;
  getAnchorRect?: () => Pick<DOMRect, "left" | "bottom">;
  content: HTMLElement;
  mode: "popover" | "dialog";
  onClose?: (reason: OverlayClose) => void;
}
export interface OverlayController {
  open(options: OverlayOptions): void;
  getOpenId(): string | null;
  reposition(): void;
  close(reason: OverlayClose): void;
  destroy(): void;
}

export function positionTool(
  pane: HTMLElement,
  anchor: HTMLElement | Pick<DOMRect, "left" | "bottom">,
): void {
  const win = pane.ownerDocument.defaultView!,
    rect =
      "getBoundingClientRect" in anchor
        ? anchor.getBoundingClientRect()
        : anchor,
    box = pane.getBoundingClientRect(),
    viewport = win.visualViewport,
    width = viewport?.width ?? win.innerWidth,
    height = viewport?.height ?? win.innerHeight,
    left = viewport?.offsetLeft ?? 0,
    top = viewport?.offsetTop ?? 0;
  pane.style.left =
    Math.max(left + 8, Math.min(left + width - box.width - 8, rect.left)) +
    "px";
  pane.style.top =
    Math.max(
      top + 8,
      Math.min(top + height - box.height - 8, rect.bottom + 8),
    ) + "px";
}

export function copyToolTheme(root: HTMLElement, target: HTMLElement): void {
  const style = root.ownerDocument.defaultView!.getComputedStyle(root);
  for (const name of [
    "--mce-accent",
    "--mce-line",
    "--mce-panel",
    "--mce-fg",
    "--mce-muted",
    "--mce-soft",
  ])
    target.style.setProperty(name, style.getPropertyValue(name));
  target.style.colorScheme = style.colorScheme;
}
export function createOverlays(root: HTMLElement): OverlayController {
  const doc = root.ownerDocument,
    win = doc.defaultView!;
  let current: OverlayOptions | null = null,
    pane: HTMLElement | null = null,
    destroyed = false,
    modal = false;
  let observer: ResizeObserver | undefined;
  const notify = () => root.dispatchEvent(new win.Event("mce-overlay-change"));
  function position() {
    if (!current || !pane || modal) return;
    positionTool(pane, current.getAnchorRect?.() ?? current.anchor);
  }
  function makePane(focus = true) {
    if (!current) return;
    const prior = pane,
      active =
        doc.activeElement instanceof win.HTMLElement ? doc.activeElement : null;
    const preserve = active && current.content.contains(active) ? active : null;
    observer?.disconnect();
    modal =
      current.mode === "dialog" ||
      (win.visualViewport?.width ?? win.innerWidth) < 640;
    if (prior instanceof win.HTMLDialogElement && prior.open) prior.close();
    pane = doc.createElement(modal ? "dialog" : "div");
    pane.className = "mce-popout";
    pane.dataset.presentation = modal
      ? current.mode === "popover"
        ? "sheet"
        : "dialog"
      : "popover";
    pane.setAttribute("role", "dialog");
    pane.setAttribute("aria-label", current.label);
    pane.setAttribute("aria-modal", String(modal));
    copyToolTheme(root, pane);
    pane.append(current.content);
    doc.body.append(pane);
    prior?.remove();
    if (pane instanceof win.HTMLDialogElement) {
      pane.addEventListener("cancel", (e) => {
        e.preventDefault();
        close("cancel");
      });
      pane.showModal();
    }
    position();
    observer = new win.ResizeObserver(position);
    observer.observe(pane);
    if (preserve?.isConnected) preserve.focus();
    else if (focus)
      current.content
        .querySelector<HTMLElement>(
          "input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[contenteditable=true]",
        )
        ?.focus();
    notify();
  }
  function close(reason: OverlayClose) {
    if (!current) return;
    const old = current,
      previous = pane;
    current = null;
    pane = null;
    observer?.disconnect();
    if (previous instanceof win.HTMLDialogElement && previous.open)
      previous.close();
    previous?.remove();
    if (reason !== "destroy" && old.anchor.isConnected) old.anchor.focus();
    old.onClose?.(reason);
    notify();
  }
  const resize = () => {
    if (!current) return;
    const nextModal =
      current.mode === "dialog" ||
      (win.visualViewport?.width ?? win.innerWidth) < 640;
    if (nextModal !== modal) makePane(false);
    else position();
  };
  const outside = (event: PointerEvent) => {
    if (!current || !pane) return;
    const target = event.target as Node;
    if (pane.contains(target) && target !== pane) return;
    if (current.anchor.contains(target)) return;
    if (!modal) close("dismiss");
    else if (target === pane) close("cancel");
  };
  const keydown = (event: KeyboardEvent) => {
    if (current && !modal && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close("dismiss");
    }
  };
  doc.addEventListener("pointerdown", outside, true);
  doc.addEventListener("keydown", keydown, true);
  doc.addEventListener("scroll", position, true);
  win.addEventListener("resize", resize);
  win.visualViewport?.addEventListener("resize", resize);
  win.visualViewport?.addEventListener("scroll", position);
  return {
    getOpenId: () => current?.id ?? null,
    reposition: position,
    open(options) {
      if (destroyed) return;
      close("dismiss");
      current = options;
      makePane();
    },
    close,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      close("destroy");
      doc.removeEventListener("pointerdown", outside, true);
      doc.removeEventListener("keydown", keydown, true);
      doc.removeEventListener("scroll", position, true);
      win.removeEventListener("resize", resize);
      win.visualViewport?.removeEventListener("resize", resize);
      win.visualViewport?.removeEventListener("scroll", position);
    },
  };
}
