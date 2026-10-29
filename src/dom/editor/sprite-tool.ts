import { spriteResourceId } from "../../core/text/sprites.js";
import { element } from "../render.js";
import { SpritePainter } from "../sprites.js";
import { fieldEditable, toolButton, toolField, toolLabel } from "./ui.js";
import type { ToolHandle, ToolMount, TextToolRequest } from "./tool-types.js";

export function mountSpriteTool(mount: ToolMount): ToolHandle {
  const { root, controller, overlays } = mount,
    doc = root.ownerDocument;
  let dispose = () => {},
    signature = "",
    provider = controller.getOptions().context.spriteProvider;
  const key = () =>
    JSON.stringify([
      controller.getOptions().spriteCatalog,
      controller.getOptions().context.profile,
    ]);
  const allowed = () =>
    controller.getOptions().features?.sprites !== false &&
    fieldEditable(mount, "motd");
  const request = (event: Event) => {
    const { tool, anchor, selection } = (event as CustomEvent<TextToolRequest>)
      .detail;
    if (tool !== "sprite" || selection.field !== "motd" || !allowed()) return;
    const options = controller.getOptions(),
      context = options.context;
    signature = key();
    provider = context.spriteProvider;
    const content = element(
        doc,
        "section",
        "mce-tool-content mce-sprite-picker",
      ),
      heading = element(doc, "div", "mce-tool-heading");
    const label = toolLabel(mount, "insertSprite", "Insert sprite");
    heading.append(
      element(doc, "strong", "", label),
      toolButton(doc, "✕", toolLabel(mount, "close", "Close"), () =>
        overlays.close("dismiss"),
      ),
    );
    const search = element(doc, "input", "");
    search.type = "search";
    const list = element(doc, "div", "mce-sprite-grid"),
      empty = element(
        doc,
        "div",
        "mce-sprite-empty",
        toolLabel(mount, "noSprites", "No matching sprites"),
      );
    content.append(
      heading,
      toolField(
        doc,
        toolLabel(mount, "searchSprites", "Search sprites"),
        search,
      ),
      list,
      empty,
    );
    const painter = new SpritePainter(doc),
      entries = (options.spriteCatalog ?? [])
        .slice(0, 4096)
        .filter(
          (item) =>
            typeof item.label === "string" &&
            spriteResourceId(item.atlas) === item.atlas &&
            spriteResourceId(item.sprite) === item.sprite,
        );
    const render = () => {
      painter.clear();
      list.replaceChildren();
      const query = search.value.trim().toLocaleLowerCase();
      const seen = new Set<string>();
      for (const item of entries) {
        const id = item.atlas + "|" + item.sprite;
        if (
          seen.has(id) ||
          !`${item.label} ${item.atlas} ${item.sprite}`
            .toLocaleLowerCase()
            .includes(query)
        )
          continue;
        seen.add(id);
        if (list.childElementCount >= 60) break;
        const compatible =
          !!context.profile.atlasSprites &&
          (!item.profiles || item.profiles.includes(context.profile.id));
        const kind = compatible
          ? toolLabel(
              mount,
              item.animated ? "animatedSprite" : "staticSprite",
              item.animated ? "Animated" : "Static",
            )
          : toolLabel(
              mount,
              "spriteIncompatible",
              "Unavailable for this client",
            );
        const name = toolLabel(mount, "spriteChoice", "{label} · {kind}", {
          label: item.label,
          kind,
        });
        const button = toolButton(doc, "", name, () => {
          if (
            !allowed() ||
            signature !== key() ||
            provider !== controller.getOptions().context.spriteProvider
          )
            return;
          controller.insertSprite(item, selection);
          overlays.close("apply");
        });
        button.classList.add("mce-sprite-choice");
        button.disabled = !compatible;
        const icon = element(doc, "span", "mce-sprite-thumbnail");
        painter.paint(
          icon,
          {
            sprite: item,
            style: { shadowColor: 0 },
            color: "#ffffff",
            advance: 8,
          },
          {
            ...context,
            animations: false,
            spriteProvider: (sprite, profile) => {
              const asset = context.spriteProvider?.(sprite, profile);
              return asset ? { frames: asset.frames.slice(0, 1) } : undefined;
            },
          },
        );
        button.append(
          icon,
          element(doc, "span", "", item.label),
          element(doc, "small", "", kind),
        );
        if (item.requiresResourcePack)
          button.append(
            element(
              doc,
              "small",
              "",
              toolLabel(
                mount,
                "spriteResourcePack",
                "Requires a locally enabled client pack",
              ),
            ),
          );
        list.append(button);
      }
      empty.hidden = !!list.childElementCount;
    };
    search.addEventListener("input", render);
    render();
    overlays.open({
      id: "sprite",
      label,
      anchor,
      content,
      mode: "popover",
      onClose: () => {
        painter.destroy();
        dispose = () => {};
        controller.focus("motd");
      },
    });
    dispose = () => painter.destroy();
    search.focus();
  };
  root.addEventListener("mce-text-tool", request);
  const unsubscribe = controller.subscribe((event) => {
    if (
      overlays.getOpenId() === "sprite" &&
      (event === "replace" ||
        !allowed() ||
        signature !== key() ||
        provider !== controller.getOptions().context.spriteProvider)
    )
      overlays.close(event === "replace" ? "replace" : "cancel");
  });
  return {
    update() {},
    destroy() {
      unsubscribe();
      root.removeEventListener("mce-text-tool", request);
      dispose();
      if (overlays.getOpenId() === "sprite") overlays.close("destroy");
    },
  };
}
