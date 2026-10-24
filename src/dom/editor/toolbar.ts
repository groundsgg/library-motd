import { setLabelAttribute } from "../localization.js";
import { element } from "../render.js";
import { copyToolTheme } from "./overlays.js";
import {
  activeStyle,
  fieldEditable,
  toolButton,
  toolLabel,
  toolLocked,
} from "./ui.js";
import type { ToolMount, ToolHandle, TextToolRequest } from "./tool-types.js";
import type { TextStyle } from "../../core/model.js";

export function mountToolbar(mount: ToolMount): ToolHandle {
  const { root, controller, overlays } = mount,
    doc = root.ownerDocument,
    win = doc.defaultView!;
  const host = element(doc, "div", "mce-tool-host"),
    toolbar = element(doc, "div", "mce-toolbar"),
    actions = element(doc, "div", "mce-entry-actions");
  toolbar.role = "toolbar";
  host.append(actions, toolbar);
  root.insertBefore(host, root.querySelector(".mce-canvas"));
  const controls: {
    button: HTMLButtonElement;
    key: string;
    fallback: string;
    style?: keyof TextStyle;
    motdOnly?: boolean;
  }[] = [];
  let forced = false,
    destroyed = false;
  function editable() {
    const field = controller.getActiveField();
    return fieldEditable(mount, field) && !!controller.getView(field);
  }
  function add(
    text: string,
    key: string,
    label: string,
    action: () => void,
    style?: keyof TextStyle,
    motdOnly = false,
  ) {
    const b = toolButton(doc, text, label, () => {
      if (editable()) action();
    });
    b.addEventListener("mousedown", (e) => e.preventDefault());
    toolbar.append(b);
    controls.push({ button: b, key, fallback: label, style, motdOnly });
    return b;
  }
  for (const [key, text, label] of [
    ["bold", "B", "Bold"],
    ["italic", "I", "Italic"],
    ["underlined", "U", "Underline"],
  ] as const)
    add(
      text,
      key,
      label,
      () =>
        controller.execute({
          type: "format",
          style: { [key]: !activeStyle(mount)[key] },
        }),
      key,
    );
  function tool(
    tool: TextToolRequest["tool"],
    text: string,
    key: string,
    label: string,
  ) {
    const b = add(text, key, label, () => {
      const selection = controller.captureSelection();
      if (selection)
        root.dispatchEvent(
          new win.CustomEvent<TextToolRequest>("mce-text-tool", {
            detail: { tool, anchor: b, selection },
          }),
        );
    });
    return b;
  }
  tool("color", "A", "color", "Text color");
  tool("gradient", "▥", "gradient", "Gradient");
  tool("placeholder", "{ }", "placeholder", "Insert placeholder");
  for (const [value, glyph, key, name] of [
    ["left", "≡←", "alignLeft", "Align left"],
    ["center", "≡", "alignCenter", "Align center"],
    ["right", "→≡", "alignRight", "Align right"],
  ] as const) {
    add(
      glyph,
      key,
      name,
      () => {
        const view = controller.getView("motd");
        if (view)
          controller.execute({
            type: "align",
            line: view.state.selection.$from.index(0),
            align: value,
          });
      },
      undefined,
      true,
    );
  }
  tool("decorations", "⋯", "moreFormatting", "More formatting");
  const undo = toolButton(doc, "↶", toolLabel(mount, "undo", "Undo"), () =>
    controller.execute({ type: "undo" }),
  );
  const redo = toolButton(doc, "↷", toolLabel(mount, "redo", "Redo"), () =>
    controller.execute({ type: "redo" }),
  );
  const show = toolButton(
    doc,
    toolLabel(mount, "textTools", "Text tools"),
    toolLabel(mount, "textTools", "Text tools"),
    () => {
      forced = true;
      update();
      controls.find((c) => !c.button.disabled)?.button.focus();
    },
  );
  actions.append(show, undo, redo);
  function position() {
    if (toolbar.hidden || controller.getOptions().toolbar !== "selection")
      return;
    const view = controller.getView(controller.getActiveField());
    if (!view) return;
    const at = view.coordsAtPos(view.state.selection.from),
      box = toolbar.getBoundingClientRect();
    const viewport = win.visualViewport,
      width = viewport?.width ?? win.innerWidth,
      height = viewport?.height ?? win.innerHeight,
      left = viewport?.offsetLeft ?? 0,
      top = viewport?.offsetTop ?? 0;
    toolbar.style.left =
      Math.max(left + 8, Math.min(left + width - box.width - 8, at.left)) +
      "px";
    toolbar.style.top =
      Math.max(
        top + 8,
        Math.min(top + height - box.height - 8, at.top - box.height - 8),
      ) + "px";
  }
  function update() {
    if (destroyed) return;
    const options = controller.getOptions(),
      selection = options.toolbar === "selection",
      view = controller.getView(controller.getActiveField());
    const nativeSelection = doc.getSelection();
    const nativeSelected = !!(
      view &&
      nativeSelection &&
      !nativeSelection.isCollapsed &&
      view.dom.contains(nativeSelection.anchorNode) &&
      view.dom.contains(nativeSelection.focusNode)
    );
    const parent = selection ? doc.body : host;
    if (toolbar.parentElement !== parent) parent.append(toolbar);
    toolbar.dataset.placement = selection ? "selection" : "fixed";
    copyToolTheme(root, toolbar);
    setLabelAttribute(
      toolbar,
      "aria-label",
      toolLabel(mount, "formatting", "Text formatting"),
    );
    toolbar.hidden =
      selection &&
      (!editable() ||
        !!overlays.getOpenId() ||
        (!forced &&
          (!view?.hasFocus() ||
            view.state.selection.empty ||
            !nativeSelected)));
    if (!selection) {
      toolbar.style.left = "";
      toolbar.style.top = "";
    }
    const style = activeStyle(mount);
    for (const item of controls) {
      setLabelAttribute(
        item.button,
        "aria-label",
        toolLabel(mount, item.key, item.fallback),
      );
      setLabelAttribute(
        item.button,
        "title",
        toolLabel(mount, item.key, item.fallback),
      );
      item.button.disabled =
        !editable() ||
        (!!item.motdOnly && controller.getActiveField() !== "motd");
      if (item.style)
        setLabelAttribute(
          item.button,
          "aria-pressed",
          String(!!style[item.style]),
        );
    }
    undo.disabled = redo.disabled = toolLocked(mount);
    show.disabled = !editable();
    setLabelAttribute(undo, "aria-label", toolLabel(mount, "undo", "Undo"));
    setLabelAttribute(redo, "aria-label", toolLabel(mount, "redo", "Redo"));
    setLabelAttribute(
      show,
      "aria-label",
      toolLabel(mount, "textTools", "Text tools"),
    );
    const focusable = controls.filter((c) => !c.button.disabled);
    for (const c of controls) c.button.tabIndex = c === focusable[0] ? 0 : -1;
    position();
  }
  const keydown = (event: KeyboardEvent) => {
    const target = event.target as Node;
    if (
      !root.contains(target) &&
      !toolbar.contains(target) &&
      !controller.getView(controller.getActiveField())?.dom.contains(target)
    )
      return;
    if (event.altKey && event.key === "F10") {
      event.preventDefault();
      event.stopPropagation();
      forced = true;
      update();
      controls.find((c) => !c.button.disabled)?.button.focus();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      forced = false;
      update();
      controller.focus(controller.getActiveField());
    }
  };
  const toolbarKeys = (event: KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const buttons = controls.map((c) => c.button).filter((b) => !b.disabled),
      index = buttons.indexOf(doc.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowLeft" ? -1 : 1) + buttons.length) %
            buttons.length;
    buttons[next]?.focus();
  };
  const outside = (event: PointerEvent) => {
    if (
      !toolbar.contains(event.target as Node) &&
      !actions.contains(event.target as Node)
    ) {
      forced = false;
      update();
    }
  };
  const selectionChanged = () => {
    if (!toolbar.contains(doc.activeElement)) forced = false;
    update();
  };
  const unsubscribe = controller.subscribe((event) => {
    if (event === "replace") forced = false;
    update();
  });
  doc.addEventListener("keydown", keydown);
  toolbar.addEventListener("keydown", toolbarKeys);
  root.addEventListener("mce-overlay-change", update);
  doc.addEventListener("pointerdown", outside);
  doc.addEventListener("selectionchange", selectionChanged);
  doc.addEventListener("scroll", position, true);
  win.addEventListener("resize", position);
  update();
  return {
    update,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      doc.removeEventListener("keydown", keydown);
      toolbar.removeEventListener("keydown", toolbarKeys);
      root.removeEventListener("mce-overlay-change", update);
      doc.removeEventListener("pointerdown", outside);
      doc.removeEventListener("selectionchange", selectionChanged);
      doc.removeEventListener("scroll", position, true);
      win.removeEventListener("resize", position);
      toolbar.remove();
      host.remove();
    },
  };
}
