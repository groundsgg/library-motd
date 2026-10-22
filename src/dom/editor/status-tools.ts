import { evaluateStatus } from "../../core/status/evaluate.js";
import { parseText } from "../../core/text/parse.js";
import type { CountRule } from "../../core/model.js";
import { element } from "../render.js";
import { copyToolTheme, positionTool } from "./overlays.js";
import {
  entryToolActions,
  toolButton,
  toolField,
  toolLabel,
  toolLocked,
} from "./ui.js";
import type { ToolMount, ToolHandle } from "./tool-types.js";

/** Status settings and pinned text share the controller, never the native tooltip. */
export function mountStatusTools(mount: ToolMount): ToolHandle {
  const { root, entry, controller, overlays } = mount,
    doc = root.ownerDocument,
    win = doc.defaultView!,
    anchors = entry.getAnchors(),
    dormant = element(doc, "div", ""),
    versionHost = element(doc, "div", ""),
    hoverHost = element(doc, "div", "");
  dormant.hidden = true;
  dormant.append(versionHost, hoverHost);
  root.append(dormant);
  let destroyed = false,
    updating = false,
    panel: HTMLElement | null = null,
    pinned: "hover" | "version" | null = null,
    syncOverlay: (() => void) | null = null,
    syncPinned: (() => void) | null = null;
  const label = (key: string, fallback: string) =>
    toolLabel(mount, key, fallback);
  const allowed = (field: "players" | "version" | "hover") =>
    !toolLocked(mount) && controller.getOptions().features?.[field] !== false;
  function compatible() {
    const state = controller.getDocument(),
      context = controller.getOptions().context,
      value = evaluateStatus(state, context).value ?? context.base;
    return state.version.mode === "always"
      ? false
      : (context.compatible ??
          context.clientProtocol === value.version.protocol);
  }
  const menu = toolButton(
    doc,
    "⋯",
    label("entryTools", "Server entry tools"),
    openMenu,
  );
  menu.dataset.entryMenu = "true";
  root.querySelector(".mce-entry-actions")!.append(menu);
  function select(
    name: string,
    items: [string, string][],
    change: (value: string) => void,
  ) {
    const input = element(doc, "select", "");
    for (const [value, text] of items) {
      const option = element(doc, "option", "", text);
      option.value = value;
      input.append(option);
    }
    input.addEventListener("change", () => change(input.value));
    return { input, field: toolField(doc, name, input) };
  }
  function content(title: string, close: () => void, closeName = "Close") {
    const body = element(doc, "div", "mce-tool-content"),
      heading = element(doc, "div", "mce-tool-heading");
    heading.append(
      element(doc, "strong", "", title),
      toolButton(doc, "×", closeName, close),
    );
    body.append(heading);
    return body;
  }
  function open(
    id: string,
    title: string,
    anchor: HTMLElement,
    body: HTMLElement,
    sync = () => {},
  ) {
    overlays.open({
      id: "status:" + id,
      label: title,
      anchor,
      content: body,
      mode: "popover",
      onClose: () => {
        syncOverlay = null;
      },
    });
    syncOverlay = sync;
    sync();
  }
  function openMenu() {
    if (menu.disabled) return;
    closePinned();
    const body = content(label("entryTools", "Server entry tools"), () =>
      overlays.close("dismiss"),
    );
    const buttons = menuActions().map((item) => {
      const button = toolButton(doc, item.label, item.label, item.action);
      button.disabled = !item.enabled;
      body.append(button);
      return button;
    });
    open("menu", label("entryTools", "Server entry tools"), menu, body, () => {
      const items = menuActions();
      if (items.length !== buttons.length) {
        overlays.close("dismiss");
        return;
      }
      buttons.forEach((button, index) => {
        const item = items[index]!;
        button.disabled = !item.enabled;
        button.textContent = item.label;
        button.setAttribute("aria-label", item.label);
        button.title = item.label;
      });
    });
  }
  function menuActions() {
    return entryToolActions(
      root,
      (
        [
          [
            "players",
            "playerDisplay",
            "Player display",
            () => openPlayers(menu),
          ],
          [
            "version",
            "versionSettings",
            "Version settings",
            () => openVersion(menu),
          ],
          ["hover", "playerHover", "Player hover", () => openPinned("hover")],
        ] as const
      ).map(([field, key, title, action]) => ({
        label: label(key, title),
        enabled: allowed(field),
        action,
      })),
    );
  }
  function openPlayers(anchor: HTMLElement) {
    if (!allowed("players")) return;
    closePinned();
    const body = content(label("playerDisplay", "Player display"), () =>
        overlays.close("dismiss"),
      ),
      hidden = element(doc, "input", "");
    hidden.type = "checkbox";
    hidden.addEventListener("change", () => {
      if (allowed("players"))
        controller.execute({
          type: "set-field",
          field: "players",
          value: {
            ...controller.getDocument().players,
            hidden: hidden.checked,
          },
        });
    });
    body.append(
      toolField(doc, label("hidePlayers", "Hide player count"), hidden),
    );
    const syncRules: (() => void)[] = [];
    for (const field of ["online", "maximum"] as const) {
      const title = field === "online" ? "Online players" : "Maximum players";
      const mode = select(
        label(field + "Mode", title + " mode"),
        [
          ["inherit", "Live value"],
          ["fixed", "Fixed value"],
          ["offset", "Add offset"],
          ["percent", "Percent of live value"],
          ...(field === "maximum"
            ? [["headroom", "Free slots above online"] as [string, string]]
            : []),
        ],
        (value) => {
          if (!allowed("players")) return;
          const players = controller.getDocument().players;
          controller.execute({
            type: "set-field",
            field: "players",
            value: {
              ...players,
              [field]:
                value === "inherit"
                  ? { mode: value }
                  : { mode: value, value: value === "percent" ? 100 : 0 },
            },
          });
        },
      );
      const number = element(doc, "input", "");
      number.type = "number";
      const numberField = toolField(
        doc,
        label(field + "Value", title + " value"),
        number,
      );
      number.addEventListener("input", () => {
        const players = controller.getDocument().players,
          rule = players[field],
          value = Number(number.value);
        if (
          allowed("players") &&
          rule.mode !== "inherit" &&
          Number.isFinite(value)
        )
          controller.execute({
            type: "set-field",
            field: "players",
            value: { ...players, [field]: { ...rule, value } },
          });
      });
      body.append(mode.field, numberField);
      syncRules.push(() => {
        const rule: CountRule = controller.getDocument().players[field];
        mode.input.value = rule.mode;
        numberField.hidden = rule.mode === "inherit";
        if (rule.mode !== "inherit" && doc.activeElement !== number)
          number.value = String(rule.value);
      });
    }
    open(
      "players",
      label("playerDisplay", "Player display"),
      anchor,
      body,
      () => {
        hidden.checked = controller.getDocument().players.hidden;
        syncRules.forEach((fn) => fn());
      },
    );
  }
  function openVersion(anchor: HTMLElement) {
    if (!allowed("version")) return;
    closePinned();
    const body = content(label("versionSettings", "Version settings"), () =>
        overlays.close("dismiss"),
      ),
      mode = select(
        label("versionDisplay", "Version display"),
        [
          ["automatic", "Automatic"],
          ["when-incompatible", "Custom when incompatible"],
          ["always", "Custom always"],
        ],
        (mode) => {
          if (!allowed("version")) return;
          const previous = controller.getDocument().version;
          controller.execute({
            type: "set-field",
            field: "version",
            value:
              mode === "automatic"
                ? { mode }
                : {
                    mode,
                    text:
                      previous.mode === "automatic"
                        ? parseText("<red>Maintenance", "minimessage").value!
                        : previous.text,
                  },
          });
        },
      ),
      reason = element(doc, "p", "mce-tool-hint"),
      edit = toolButton(
        doc,
        label("editHiddenVersion", "Edit hidden version text"),
        label("editHiddenVersion", "Edit hidden version text"),
        () => openPinned("version"),
      );
    body.append(mode.field, reason, edit);
    open(
      "version",
      label("versionSettings", "Version settings"),
      anchor,
      body,
      () => {
        const state = controller.getDocument();
        mode.input.value = state.version.mode;
        edit.hidden = state.version.mode === "automatic" || !compatible();
        reason.textContent = label(
          "versionHint",
          state.version.mode === "automatic"
            ? "Choose a custom mode to edit version text."
            : compatible()
              ? "This client shows player counts. Custom version text is kept for incompatible clients."
              : "Edit the version text directly in the server entry.",
        );
      },
    );
  }
  function closePinned(focus = true) {
    if (!panel) return;
    if (!destroyed && controller.getActiveField() === pinned)
      controller.focus("motd");
    // Detach the entire mount, preserving the ProseMirror view and its selection.
    dormant.append(pinned === "version" ? versionHost : hoverHost);
    panel.remove();
    panel = null;
    pinned = null;
    syncPinned = null;
    delete anchors.playerHover.dataset.editorPinned;
    if (focus && !destroyed) menu.focus();
  }
  function openPinned(field: "hover" | "version") {
    if (
      !allowed(field) ||
      (field === "version" &&
        controller.getDocument().version.mode === "automatic")
    )
      return;
    overlays.close("dismiss");
    closePinned(false);
    pinned = field;
    const title = label(
      field + "Editor",
      field === "hover" ? "Player hover editor" : "Version text editor",
    );
    panel = element(doc, "div", "mce-popout mce-pinned-surface");
    panel.role = "dialog";
    panel.setAttribute("aria-label", title);
    panel.setAttribute("aria-modal", "false");
    const body = content(
        title,
        () => {
          closePinned();
          update();
        },
        label(
          "close" + field,
          field === "hover" ? "Close player hover" : "Close version text",
        ),
      ),
      hint = element(doc, "p", "mce-tool-status"),
      text = field === "hover" ? hoverHost : versionHost;
    hint.role = "status";
    let mode: ReturnType<typeof select> | undefined;
    if (field === "hover") {
      mode = select(
        label("playerHover", "Player hover"),
        [
          ["inherit", "Live player list"],
          ["custom", "Custom text"],
          ["disabled", "No custom entries"],
        ],
        (mode) => {
          if (!allowed("hover")) return;
          const before = controller.getDocument().hover;
          controller.execute({
            type: "set-field",
            field: "hover",
            value:
              mode === "custom"
                ? {
                    mode,
                    text:
                      before.mode === "custom"
                        ? before.text
                        : parseText(
                            "<gold>Welcome<newline><gray>{{players}} players online",
                            "minimessage",
                          ).value!,
                  }
                : { mode },
          });
        },
      );
      body.append(mode.field);
    } else entry.bindText("version", null);
    body.append(hint, text);
    panel.append(body);
    doc.body.append(panel);
    syncPinned = () => {
      const state = controller.getDocument(),
        active = field === "version" || state.hover.mode === "custom";
      if (mode) mode.input.value = state.hover.mode;
      text.hidden = !active;
      if (active) controller.mountText(field, text);
      hint.textContent =
        field === "hover"
          ? label(
              "hoverHint",
              !compatible() || state.players.hidden
                ? "This client cannot display player hover with the current status settings. Your custom text remains editable."
                : state.hover.mode === "inherit"
                  ? "The live player list is displayed. Choose Custom text to edit it."
                  : state.hover.mode === "disabled"
                    ? "Custom entries are disabled. Choose Custom text to edit them."
                    : "",
            )
          : "";
    };
    anchors.playerHover.dataset.editorPinned = "true";
    anchors.playerHover.hidden = true;
    update();
    if (field === "version" || controller.getDocument().hover.mode === "custom")
      controller.focus(field);
    else mode?.input.focus();
  }
  function position() {
    if (panel) positionTool(panel, menu);
  }
  function update() {
    if (destroyed || updating || controller.isComposing()) return;
    updating = true;
    try {
      menu.disabled = !menuActions().some((item) => item.enabled);
      menu.setAttribute(
        "aria-label",
        label("entryTools", "Server entry tools"),
      );
      if (
        pinned &&
        (!allowed(pinned) ||
          (pinned === "version" &&
            controller.getDocument().version.mode === "automatic"))
      )
        closePinned();
      const id = overlays.getOpenId();
      if (
        id?.startsWith("status:") &&
        ((id === "status:menu" && menu.disabled) ||
          (id !== "status:menu" && !allowed(id.slice(7) as "players")))
      )
        overlays.close("dismiss");
      const state = controller.getDocument(),
        visible =
          state.version.mode !== "automatic" &&
          controller.getOptions().features?.version !== false &&
          !compatible();
      if (pinned === "version" && visible) {
        const focused = !!controller.getView("version")?.hasFocus();
        closePinned(false);
        entry.bindText("version", versionHost);
        if (focused) controller.focus("version");
      }
      if (visible && pinned !== "version") {
        controller.mountText("version", versionHost);
        versionHost.hidden = false;
        entry.bindText("version", versionHost);
      } else {
        entry.bindText("version", null);
        if (pinned !== "version" && versionHost.parentElement !== dormant)
          dormant.append(versionHost);
      }
      syncOverlay?.();
      syncPinned?.();
      if (panel) {
        copyToolTheme(root, panel);
        panel.style.setProperty(
          "--mcp-font",
          win.getComputedStyle(anchors.motd).getPropertyValue("--mcp-font"),
        );
        panel.style.setProperty(
          "--mce-text-scale",
          String(Math.max(0.5, controller.getOptions().context.guiScale)),
        );
        position();
      }
    } finally {
      updating = false;
    }
  }
  const statusClick = (event: MouseEvent) => {
    if ((event.target as Element).closest(".mce-inline")) return;
    if (compatible()) openPlayers(anchors.status);
    else openVersion(anchors.ping);
  };
  const pingClick = () => openVersion(anchors.ping);
  const keydown = (event: KeyboardEvent) => {
    if (
      event.key === "Escape" &&
      panel &&
      !overlays.getOpenId() &&
      panel.contains(event.target as Node)
    ) {
      event.preventDefault();
      closePinned();
      update();
    }
  };
  anchors.status.addEventListener("click", statusClick);
  anchors.ping.addEventListener("click", pingClick);
  doc.addEventListener("keydown", keydown);
  doc.addEventListener("scroll", position, true);
  win.addEventListener("resize", position);
  win.visualViewport?.addEventListener("resize", position);
  win.visualViewport?.addEventListener("scroll", position);
  const observer = new win.ResizeObserver(position);
  const unsubscribe = controller.subscribe((event) => {
    if (event === "replace") {
      closePinned(false);
      if (overlays.getOpenId()?.startsWith("status:"))
        overlays.close("replace");
    }
    if (event !== "selection") update();
    if (panel) observer.observe(panel);
  });
  update();
  return {
    update,
    destroy() {
      destroyed = true;
      unsubscribe();
      closePinned(false);
      observer.disconnect();
      anchors.status.removeEventListener("click", statusClick);
      anchors.ping.removeEventListener("click", pingClick);
      doc.removeEventListener("keydown", keydown);
      doc.removeEventListener("scroll", position, true);
      win.removeEventListener("resize", position);
      win.visualViewport?.removeEventListener("resize", position);
      win.visualViewport?.removeEventListener("scroll", position);
      menu.remove();
      dormant.remove();
    },
  };
}
