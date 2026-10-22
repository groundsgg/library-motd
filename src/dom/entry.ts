import type { Diagnostic } from "../core/model.js";
import {
  evaluateStatus,
  evaluatePlayerCounts,
} from "../core/status/evaluate.js";
import { resolveText } from "../core/text/placeholders.js";
import { parseText } from "../core/text/parse.js";
import { layoutText } from "../core/layout/layout.js";
import { bindTooltip } from "./tooltips.js";
import { animateObfuscation } from "./animation.js";
import {
  element,
  renderText,
  type PreviewHandle,
  type PreviewOptions,
} from "./render.js";
import type { EditableField } from "./editor/types.js";

export interface EntryHandle extends PreviewHandle {
  getAnchors(): {
    icon: HTMLElement;
    motd: HTMLElement;
    status: HTMLElement;
    ping: HTMLElement;
    playerHover: HTMLElement;
  };
  bindText(field: EditableField, content: HTMLElement | null): void;
}

/** Persistent field mounts are shared by the viewer and editor. */
export function createEntry(
  host: HTMLElement,
  initial: PreviewOptions,
): EntryHandle {
  const doc = host.ownerDocument;
  const wrapper = element(doc, "div", "mcp-wrap"),
    stage = element(doc, "div", "mcp-stage"),
    scene = element(doc, "div", "mcp-scene");
  const backdrop = element(doc, "div", "mcp-background"),
    listBackground = element(doc, "div", "mcp-list-background");
  const title = element(doc, "div", "mcp-menu-title"),
    footer = element(doc, "div", "mcp-menu-footer"),
    selection = element(doc, "div", "mcp-selection");
  const row = element(doc, "div", "mcp-row"),
    icon = element(doc, "div", "mcp-icon"),
    name = element(doc, "div", "mcp-server-name");
  const status = element(doc, "div", "mcp-players"),
    statusAction = element(doc, "button", "mcp-status-action");
  const ping = element(doc, "button", "mcp-ping"),
    motd = element(doc, "div", "mcp-motd");
  const playerHover = element(doc, "div", ""),
    pingTip = element(doc, "div", "");
  const bindings = new Map<EditableField, HTMLElement>();
  let options = initial,
    destroyed = false,
    diagnostics: Diagnostic[] = [],
    stop = () => {},
    playerTipEnabled = false;
  statusAction.type = "button";
  ping.type = "button";
  Object.assign(statusAction.style, {
    font: "inherit",
    color: "inherit",
    border: "0",
    background: "transparent",
    padding: "0",
    lineHeight: "inherit",
    textAlign: "inherit",
  });
  icon.dataset.field = "icon";
  motd.dataset.field = "motd";
  status.dataset.field = "version";
  row.role = "group";
  footer.setAttribute("aria-hidden", "true");
  status.append(statusAction);
  row.append(icon, name, status, ping, motd);
  scene.append(backdrop, listBackground, title, footer, selection, row);
  stage.append(scene);
  wrapper.append(stage);
  host.append(wrapper);
  const disposeTips = [
    bindTooltip(
      statusAction,
      playerHover,
      wrapper,
      () => playerTipEnabled && !bindings.has("hover"),
    ),
    bindTooltip(ping, pingTip, wrapper),
  ];
  function put(field: EditableField, target: HTMLElement, render: () => void) {
    const bound = bindings.get(field);
    if (bound) {
      if (bound.parentElement !== target) target.replaceChildren(bound);
    } else {
      target.replaceChildren();
      render();
    }
  }
  function update(next: PreviewOptions): void {
    if (destroyed) return;
    options = next;
    stop();
    const { document: state, context } = next,
      labels = next.labels ?? {};
    const evaluated = evaluateStatus(state, context),
      value = evaluated.value ?? context.base;
    diagnostics = [...evaluated.diagnostics];
    const scale = Math.max(0.5, context.guiScale),
      g = context.profile.geometry;
    const width = Math.max(
      140,
      Math.min(g.rowWidth, context.viewportWidth / scale),
    );
    const contentWidth = Math.min(width, g.contentWidth ?? width),
      full = context.presentation !== "row";
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
        : 2,
      rowY = full ? (g.rowTop ?? 36) : 4;
    const assets = context.assetProvider?.(context.profile);
    const background =
      !context.background || context.background === "auto"
        ? (assets?.background ?? "auto")
        : context.background;
    stage.dataset.background =
      typeof background === "object"
        ? "custom"
        : background === "auto"
          ? (context.profile.background ?? "panorama")
          : background;
    stage.dataset.clientProfile = context.profile.id;
    wrapper.style.width = sceneWidth * scale + "px";
    wrapper.style.setProperty(
      "--mcp-font",
      `'${assets?.fontFamily ?? context.profile.font.family}',monospace`,
    );
    Object.assign(stage.style, {
      width: sceneWidth * scale + "px",
      height: height * scale + "px",
    });
    Object.assign(scene.style, {
      width: sceneWidth + "px",
      height: height + "px",
      transform: `scale(${scale})`,
    });
    scene.style.setProperty("--mcp-title-top", (g.titleTop ?? 19) + "px");
    scene.style.setProperty("--mcp-list-top", (g.listTop ?? 31) + "px");
    scene.style.setProperty(
      "--mcp-footer-height",
      (g.footerHeight ?? 63) + "px",
    );
    scene.style.setProperty(
      "--mcp-footer-bottom",
      (g.footerBottom ?? 9) + "px",
    );
    backdrop.style.backgroundImage =
      typeof background === "object"
        ? `url(${JSON.stringify(background.imageUrl)})`
        : "";
    title.hidden = listBackground.hidden = footer.hidden = !full;
    title.textContent = labels.multiplayerTitle ?? "Play Multiplayer";
    footer.replaceChildren();
    for (const decoration of [listBackground, title, footer]) {
      if (full && decoration.parentElement !== scene)
        scene.insertBefore(decoration, row);
      if (!full) decoration.remove();
    }
    if (full)
      for (const [key, fallback] of [
        ["joinServer", "Join Server"],
        ["directConnection", "Direct Connection"],
        ["addServer", "Add Server"],
        ["editServer", "Edit"],
        ["deleteServer", "Delete"],
        ["refreshServers", "Refresh"],
        ["back", "Back"],
      ]) {
        const b = element(
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
          Object.assign(b.style, {
            background: "transparent",
            boxShadow: "none",
            borderImageSource: `url(${JSON.stringify(source)})`,
            borderImageSlice: `${assets.buttons.border ?? 2} fill`,
            borderImageWidth: `${assets.buttons.border ?? 2}px`,
          });
        }
        footer.append(b);
      }
    selection.hidden = !context.selected;
    if (context.selected && selection.parentElement !== scene)
      scene.insertBefore(selection, row);
    if (!context.selected) selection.remove();
    Object.assign(selection.style, {
      left: rowX - 2 + "px",
      top: rowY - 2 + "px",
      width: width + "px",
    });
    Object.assign(row.style, {
      left: rowX + "px",
      top: rowY + "px",
      width: contentWidth + "px",
    });
    row.setAttribute(
      "aria-label",
      labels.serverEntry ?? "Minecraft server entry",
    );
    name.textContent = context.serverName;
    const iconSource = value.favicon?.startsWith("data:image/png;base64,")
      ? value.favicon
      : assets?.defaultServerIcon;
    const previousImage = icon.querySelector("img");
    if (iconSource) {
      if (previousImage?.getAttribute("src") !== iconSource) {
        previousImage?.remove();
        const image = element(doc, "img", "");
        image.src = iconSource;
        image.alt = labels.serverIcon ?? "Server icon";
        image.addEventListener("error", () => {
          if (image.parentElement === icon) {
            image.remove();
            icon.classList.add("mcp-icon-default");
          }
        });
        icon.prepend(image);
      } else previousImage.alt = labels.serverIcon ?? "Server icon";
      icon.classList.remove("mcp-icon-default");
    } else {
      previousImage?.remove();
      icon.classList.add("mcp-icon-default");
    }
    const compatible =
      state.version.mode === "always"
        ? false
        : (context.compatible ??
          context.clientProtocol === value.version.protocol);
    status.classList.toggle("mcp-incompatible", !compatible);
    ping.classList.toggle("mcp-incompatible", !compatible);
    statusAction.setAttribute(
      "aria-label",
      compatible
        ? (labels.onlinePlayers ?? "Online players")
        : (labels.versionInfo ?? "Version information"),
    );
    const custom = bindings.get("version");
    statusAction.hidden = !!custom && !compatible;
    if (custom && !compatible) {
      if (custom.parentElement !== status) status.append(custom);
      custom.hidden = false;
    } else if (custom) custom.hidden = true;
    statusAction.replaceChildren();
    if (compatible)
      statusAction.textContent = value.players
        ? `${value.players.online}/${value.players.max}`
        : "???";
    else {
      const text = parseText(value.version.name, "legacy-section").value;
      if (text) {
        const content = element(doc, "span", "mcp-version-text"),
          size = layoutText(text, {
            profile: context.profile,
            width: contentWidth - 42,
            maxLines: 1,
          });
        renderText(
          content,
          text,
          context,
          Math.min(contentWidth - 42, size.lines[0]?.width ?? 0),
          1,
          undefined,
          "#ff5555",
        );
        content.style.display = "block";
        statusAction.append(content);
      }
    }
    ping.replaceChildren();
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
    } else ping.textContent = "✕";
    ping.setAttribute(
      "aria-label",
      labels.connectionStatus ?? "Connection status",
    );
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
    const textWidth = contentWidth - g.iconSize - g.iconGap - g.rightInset;
    const layout = layoutText(resolved.value!, {
      profile: context.profile,
      width: textWidth,
      maxLines: 2,
      alignments: state.motd.alignments,
    });
    Object.assign(motd.style, {
      width: textWidth + "px",
      height:
        Math.min(2, layout.lines.length) * context.profile.font.lineHeight +
        "px",
    });
    put("motd", motd, () => {
      renderText(
        motd,
        resolved.value!,
        context,
        textWidth,
        2,
        state.motd.alignments,
      );
    });
    diagnostics.push(...layout.diagnostics);
    playerTipEnabled = !!(compatible && value.players?.sample.length);
    if (!playerTipEnabled) playerHover.hidden = true;
    put("hover", playerHover, () => {
      if (!playerTipEnabled) return;
      const names = value.players!.sample.map((s) => s.name),
        remaining = value.players!.online - names.length;
      if (remaining > 0)
        names.push(
          (labels.morePlayers ?? "… and {count} more …").replace(
            "{count}",
            String(remaining),
          ),
        );
      const raw = names.join("\n§r"),
        text = parseText(raw, "legacy-section").value!,
        content = element(doc, "div", "mcp-tooltip-text");
      renderText(
        content,
        text,
        context,
        Math.max(...raw.split("\n").map((l) => l.length * 6), 40),
        30,
        undefined,
        "#ffffff",
      );
      content.style.zoom = String(scale);
      playerHover.append(content);
    });
    playerHover.style.setProperty("--mcp-tooltip-scale", String(scale));
    pingTip.textContent = compatible
      ? `${context.pingMs} ms`
      : (labels.incompatible ?? "Incompatible version!");
    stop = animateObfuscation(wrapper, context.profile, context.animations);
    wrapper.dataset.profileVerified = String(context.profile.verified);
    wrapper.title = context.profile.verified
      ? ""
      : (labels.unverifiedProfile ??
        "Client profile has partial native reference coverage");
  }
  update(initial);
  return {
    update,
    getDiagnostics: () => diagnostics,
    getAnchors: () => ({ icon, motd, status, ping, playerHover }),
    bindText(field, content) {
      if (destroyed || bindings.get(field) === (content ?? undefined)) return;
      if (content) bindings.set(field, content);
      else bindings.delete(field);
      update(options);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      disposeTips.forEach((dispose) => dispose());
      wrapper.remove();
      bindings.clear();
    },
  };
}
