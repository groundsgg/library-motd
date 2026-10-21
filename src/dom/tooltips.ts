export function bindTooltip(
  target: HTMLElement,
  content: HTMLElement,
  owner: HTMLElement,
): void {
  content.classList.add("mcp-tooltip");
  content.role = "tooltip";
  content.hidden = true;
  owner.append(content);
  const show = () => {
    const r = target.getBoundingClientRect();
    content.hidden = false;
    const width = content.getBoundingClientRect().width;
    content.style.left =
      Math.max(4, Math.min(innerWidth - width - 4, r.left)) + "px";
    content.style.top =
      Math.min(innerHeight - content.offsetHeight - 4, r.bottom + 6) + "px";
  };
  const hide = () => {
    content.hidden = true;
  };
  target.addEventListener("mouseenter", show);
  target.addEventListener("mouseleave", hide);
  target.addEventListener("focus", show);
  target.addEventListener("blur", hide);
  target.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });
}
