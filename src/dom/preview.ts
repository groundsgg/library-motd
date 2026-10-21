import type {
  Alignment,
  Diagnostic,
  PreviewContext,
  ServerListDocument,
  TextDocument,
  TextStyle,
} from "../core/model.js";
import {
  evaluateStatus,
  evaluatePlayerCounts,
} from "../core/status/evaluate.js";
import { resolveText } from "../core/text/placeholders.js";
import { parseText } from "../core/text/parse.js";
import { layoutText } from "../core/layout/layout.js";
import { bindTooltip } from "./tooltips.js";
import { animateObfuscation } from "./animation.js";
export interface PreviewOptions {
  document: ServerListDocument;
  context: PreviewContext;
  labels?: Readonly<Record<string, string>>;
}
export interface PreviewHandle {
  update(options: PreviewOptions): void;
  destroy(): void;
  getDiagnostics(): readonly Diagnostic[];
}
export const element = <K extends keyof HTMLElementTagNameMap>(
  doc: Document,
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const e = doc.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
};
export function applyTextStyle(
  span: HTMLElement,
  style: TextStyle,
  color?: string,
): void {
  const fg = color ?? style.color ?? "#aaaaaa";
  span.style.color = fg;
  span.style.textShadow = "none";
  span.style.fontWeight = style.bold ? "700" : "400";
  span.style.fontStyle = style.italic ? "italic" : "normal";
  span.style.textDecoration = [
    style.underlined ? "underline" : "",
    style.strikethrough ? "line-through" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
export function renderText(
  root: HTMLElement,
  text: TextDocument,
  context: PreviewContext,
  width: number,
  maxLines = 2,
  alignments?: Alignment[],
  defaultColor?: string,
): Diagnostic[] {
  const layout = layoutText(text, {
    profile: context.profile,
    width,
    maxLines,
    alignments,
  });
  root.style.width = width + "px";
  root.style.height =
    Math.min(maxLines, layout.lines.length) * context.profile.font.lineHeight +
    "px";
  root.setAttribute("aria-label", layout.glyphs.map((g) => g.text).join(""));
  for (const glyph of layout.glyphs) {
    if (glyph.line >= maxLines) continue;
    const span = element(root.ownerDocument, "span", "mcp-glyph", glyph.text);
    span.style.left = glyph.x + "px";
    span.style.top = glyph.line * context.profile.font.lineHeight + "px";
    span.style.width = glyph.advance + "px";
    applyTextStyle(
      span,
      glyph.style,
      defaultColor &&
        !glyph.style.color &&
        !glyph.style.gradient &&
        !glyph.style.rainbow
        ? defaultColor
        : glyph.color,
    );
    if (glyph.style.obfuscated && glyph.text.trim()) {
      span.dataset.obfuscated = "";
      span.dataset.advance = String(glyph.advance - (glyph.style.bold ? 1 : 0));
    }
    root.append(span);
  }
  return layout.diagnostics;
}
export function createPreview(
  host: HTMLElement,
  initial: PreviewOptions,
): PreviewHandle {
  const doc = host.ownerDocument,
    wrapper = element(doc, "div", "mcp-wrap");
  host.append(wrapper);
  let stop = () => {},
    destroyed = false,
    diagnostics: Diagnostic[] = [];
  function update(options: PreviewOptions): void {
    if (destroyed) return;
    stop();
    wrapper.replaceChildren();
    const { document: state, context } = options,
      labels = options.labels ?? {};
    const evaluated = evaluateStatus(state, context),
      status = evaluated.value ?? context.base;
    diagnostics = [...evaluated.diagnostics];
    const scale = Math.max(0.5, context.guiScale),
      geometry = context.profile.geometry,
      width = Math.max(
        140,
        Math.min(geometry.rowWidth, context.viewportWidth / scale),
      );
    const assets = context.assetProvider?.(context.profile);
    const contentWidth = Math.min(width, geometry.contentWidth ?? width);
    const full = context.presentation !== "row";
    const sceneWidth = full
      ? Math.max(width, Math.floor(context.viewportWidth / scale))
      : width + 4;
    const height = full
      ? Math.max(
          132,
          Math.floor((context.viewportHeight ?? 180 * scale) / scale),
        )
      : 40;
    const rowX = full
      ? Math.floor(sceneWidth / 2) - Math.floor(width / 2) + 2
      : 2;
    const rowY = full ? (geometry.rowTop ?? 36) : 4;
    const stage = element(doc, "div", "mcp-stage"),
      scene = element(doc, "div", "mcp-scene"),
      row = element(doc, "div", "mcp-row");
    const background =
      !context.background || context.background === "auto"
        ? (assets?.background ?? "auto")
        : context.background;
    const backgroundKind =
      typeof background === "object"
        ? "custom"
        : background === "auto"
          ? (context.profile.background ?? "panorama")
          : background;
    stage.dataset.background = backgroundKind;
    stage.dataset.clientProfile = context.profile.id;
    wrapper.style.width = sceneWidth * scale + "px";
    wrapper.style.setProperty(
      "--mcp-font",
      `'${assets?.fontFamily ?? context.profile.font.family}',monospace`,
    );
    stage.style.width = sceneWidth * scale + "px";
    stage.style.height = height * scale + "px";
    scene.style.width = sceneWidth + "px";
    scene.style.height = height + "px";
    scene.style.transform = `scale(${scale})`;
    scene.style.setProperty(
      "--mcp-title-top",
      (geometry.titleTop ?? 19) + "px",
    );
    scene.style.setProperty("--mcp-list-top", (geometry.listTop ?? 31) + "px");
    scene.style.setProperty(
      "--mcp-footer-height",
      (geometry.footerHeight ?? 63) + "px",
    );
    scene.style.setProperty(
      "--mcp-footer-bottom",
      (geometry.footerBottom ?? 9) + "px",
    );
    const backdrop = element(doc, "div", "mcp-background");
    if (typeof background === "object")
      backdrop.style.backgroundImage = `url(${JSON.stringify(background.imageUrl)})`;
    scene.append(backdrop);
    if (full) {
      const listBackground = element(doc, "div", "mcp-list-background");
      const title = element(
        doc,
        "div",
        "mcp-menu-title",
        labels.multiplayerTitle ?? "Play Multiplayer",
      );
      const footer = element(doc, "div", "mcp-menu-footer");
      footer.setAttribute("aria-hidden", "true");
      for (const [key, fallback] of [
        ["joinServer", "Join Server"],
        ["directConnection", "Direct Connection"],
        ["addServer", "Add Server"],
        ["editServer", "Edit"],
        ["deleteServer", "Delete"],
        ["refreshServers", "Refresh"],
        ["back", "Back"],
      ]) {
        const button = element(
          doc,
          "span",
          "mcp-menu-button",
          labels[key!] ?? fallback,
        );
        if (assets?.buttons) {
          const source =
            !context.selected &&
            ["joinServer", "editServer", "deleteServer"].includes(key!)
              ? (assets.buttons.disabled ?? assets.buttons.normal)
              : assets.buttons.normal;
          Object.assign(button.style, {
            background: "transparent",
            boxShadow: "none",
            borderImageSource: `url(${JSON.stringify(source)})`,
            borderImageSlice: `${assets.buttons.border ?? 2} fill`,
            borderImageWidth: `${assets.buttons.border ?? 2}px`,
          });
        }
        footer.append(button);
      }
      scene.append(listBackground, title, footer);
    }
    if (context.selected) {
      const selection = element(doc, "div", "mcp-selection");
      Object.assign(selection.style, {
        left: rowX - 2 + "px",
        top: rowY - 2 + "px",
        width: width + "px",
      });
      scene.append(selection);
    }
    Object.assign(row.style, {
      left: rowX + "px",
      top: rowY + "px",
      width: contentWidth + "px",
    });
    row.role = "group";
    row.setAttribute(
      "aria-label",
      labels.serverEntry ?? "Minecraft server entry",
    );
    scene.append(row);
    stage.append(scene);
    wrapper.append(stage);
    const icon = element(doc, "div", "mcp-icon");
    icon.dataset.field = "icon";
    const iconSource = status.favicon?.startsWith("data:image/png;base64,")
      ? status.favicon
      : assets?.defaultServerIcon;
    if (iconSource) {
      const image = element(doc, "img", "");
      image.src = iconSource;
      image.alt = labels.serverIcon ?? "Server icon";
      image.addEventListener("error", () => {
        image.remove();
        icon.classList.add("mcp-icon-default");
      });
      icon.append(image);
    } else icon.classList.add("mcp-icon-default");
    row.append(
      icon,
      element(doc, "div", "mcp-server-name", context.serverName),
    );
    const compatible =
      state.version.mode === "always"
        ? false
        : (context.compatible ??
          context.clientProtocol === status.version.protocol);
    const players = element(doc, "button", "mcp-players");
    players.type = "button";
    players.setAttribute(
      "aria-label",
      compatible
        ? (labels.onlinePlayers ?? "Online players")
        : (labels.versionInfo ?? "Version information"),
    );
    if (compatible)
      players.textContent = status.players
        ? `${status.players.online}/${status.players.max}`
        : "???";
    else {
      players.classList.add("mcp-incompatible");
      const legacy = parseText(status.version.name, "legacy-section").value;
      if (legacy) {
        const content = element(doc, "span", "mcp-version-text");
        const size = layoutText(legacy, {
          profile: context.profile,
          width: contentWidth - 42,
          maxLines: 1,
        });
        const textWidth = size.lines[0]?.width ?? 0;
        renderText(
          content,
          legacy,
          context,
          Math.min(contentWidth - 42, textWidth),
          1,
          undefined,
          "#ff5555",
        );
        content.style.display = "block";
        players.append(content);
      }
    }
    players.dataset.field = "version";
    row.append(players);
    const ping = element(doc, "button", "mcp-ping", compatible ? "" : "✕");
    if (compatible) {
      const active =
        context.pingMs < 150
          ? 5
          : context.pingMs < 300
            ? 4
            : context.pingMs < 600
              ? 3
              : context.pingMs < 1000
                ? 2
                : 1;
      for (let i = 0; i < 5; i++) {
        const bar = element(doc, "i", "");
        bar.style.left = i * 2 + "px";
        bar.style.height = i + 2 + "px";
        if (i >= active) bar.style.background = "#555";
        ping.append(bar);
      }
    }
    ping.type = "button";
    ping.setAttribute(
      "aria-label",
      labels.connectionStatus ?? "Connection status",
    );
    if (!compatible) ping.classList.add("mcp-incompatible");
    row.append(ping);
    const motd = element(doc, "div", "mcp-motd");
    motd.dataset.field = "motd";
    const counts = evaluatePlayerCounts(state, context).value;
    const values = {
      ...context.values,
      ...(counts?.online !== undefined
        ? { players: String(counts.online) }
        : {}),
      ...(counts?.max !== undefined ? { max: String(counts.max) } : {}),
    };
    const resolved = resolveText(state.motd.text, values);
    diagnostics.push(...resolved.diagnostics);
    diagnostics.push(
      ...renderText(
        motd,
        resolved.value!,
        context,
        contentWidth -
          geometry.iconSize -
          geometry.iconGap -
          geometry.rightInset,
        2,
        state.motd.alignments,
      ),
    );
    row.append(motd);
    if (compatible && status.players && status.players.sample.length) {
      const tooltip = element(doc, "div", "");
      const names = status.players.sample.map((s) => s.name);
      const remaining = status.players.online - names.length;
      if (remaining > 0)
        names.push(
          (labels.morePlayers ?? "… and {count} more …").replace(
            "{count}",
            String(remaining),
          ),
        );
      const raw = names.join("\n§r");
      const text = parseText(raw, "legacy-section").value!;
      const content = element(doc, "div", "mcp-tooltip-text");
      const lineWidth = Math.max(
        ...raw.split("\n").map((l) => l.length * 6),
        40,
      );
      renderText(content, text, context, lineWidth, 30, undefined, "#ffffff");
      tooltip.append(content);
      tooltip.style.setProperty("--mcp-tooltip-scale", String(scale));
      content.style.zoom = String(scale);
      bindTooltip(players, tooltip, wrapper);
    }
    const pingTip = element(
      doc,
      "div",
      "",
      compatible
        ? `${context.pingMs} ms`
        : (labels.incompatible ?? "Incompatible version!"),
    );
    bindTooltip(ping, pingTip, wrapper);
    stop = animateObfuscation(wrapper, context.profile, context.animations);
    if (!context.profile.verified) {
      wrapper.dataset.profileVerified = "false";
      wrapper.title =
        labels.unverifiedProfile ??
        "Client profile has partial native reference coverage";
    }
  }
  update(initial);
  return {
    update,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      wrapper.remove();
    },
    getDiagnostics: () => diagnostics,
  };
}
