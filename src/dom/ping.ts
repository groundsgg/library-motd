/** Draw the original procedural indicator in one coordinate space. Separate
 * CSS boxes round independently under layout zoom and can merge the last bars. */
export function createPingGraphic(
  doc: Document,
  active: number,
  incompatible: boolean,
): SVGSVGElement {
  const pixels = new Map<string, string>();
  for (let bar = 0; bar < 5; bar++)
    for (let y = 5 - bar; y <= 6; y++) {
      const enabled = !incompatible && bar < active;
      pixels.set(`${bar * 2},${y}`, enabled ? "#00ff21" : "#5b5b5b");
      pixels.set(`${bar * 2 + 1},${y + 1}`, enabled ? "#00870f" : "#383838");
    }
  if (incompatible) {
    for (let y = 1; y <= 7; y++) {
      const x = 8 - y;
      for (const [offset, opacity] of [
        [1, 63],
        [2, 127],
      ] as const) {
        const key = `${x + offset},${y + 1}`,
          color = pixels.get(key);
        if (color) {
          const channel = Math.floor(
            (parseInt(color.slice(1, 3), 16) * opacity) / 255,
          )
            .toString(16)
            .padStart(2, "0");
          pixels.set(key, `#${channel.repeat(3)}`);
        }
      }
    }
    for (let y = 1; y <= 7; y++) {
      const edge = `${7 - y},${y}`;
      if (pixels.get(edge) === "#5b5b5b") pixels.set(edge, "#2d2d2d");
    }
    for (let y = 1; y <= 7; y++)
      for (const x of new Set([y, 8 - y])) {
        pixels.set(`${x},${y}`, "#ff0000");
        pixels.set(`${x + 1},${y}`, "#820000");
      }
  }
  const ns = "http://www.w3.org/2000/svg";
  const svg = doc.createElementNS(ns, "svg");
  svg.setAttribute("class", "mcp-ping-graphic");
  svg.setAttribute("viewBox", "0 0 10 8");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "8");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const paths = new Map<string, string>();
  for (const [position, color] of pixels) {
    const [x, y] = position.split(",");
    paths.set(color, (paths.get(color) ?? "") + `M${x} ${y}h1v1h-1z`);
  }
  for (const [color, d] of paths) {
    const path = doc.createElementNS(ns, "path");
    path.setAttribute("fill", color);
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}
