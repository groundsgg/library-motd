export function bindTooltip(
  target: HTMLElement,
  content: HTMLElement,
  owner: HTMLElement,
  enabled: () => boolean = () => true,
): () => void {
  content.classList.add("mcp-tooltip");
  content.role = "tooltip";
  content.hidden = true;
  owner.append(content);
  const show = () => {
    if (!enabled()) return;
    const r = target.getBoundingClientRect();
    content.hidden = false;
    const width = content.getBoundingClientRect().width;
    content.style.left =
      Math.max(
        4,
        Math.min(
          (owner.ownerDocument.defaultView?.innerWidth ?? 0) - width - 4,
          r.left,
        ),
      ) + "px";
    content.style.top =
      Math.min(
        (owner.ownerDocument.defaultView?.innerHeight ?? 0) -
          content.offsetHeight -
          4,
        r.bottom + 6,
      ) + "px";
  };
  const hide = () => {
    content.hidden = true;
  };
  target.addEventListener("mouseenter", show);
  target.addEventListener("mouseleave", hide);
  target.addEventListener("focus", show);
  target.addEventListener("blur", hide);
  const keydown = (e: KeyboardEvent) => {
    if (e.key === "Escape") hide();
  };
  target.addEventListener("keydown", keydown);
  return () => {
    target.removeEventListener("mouseenter", show);
    target.removeEventListener("mouseleave", hide);
    target.removeEventListener("focus", show);
    target.removeEventListener("blur", hide);
    target.removeEventListener("keydown", keydown);
  };
}
