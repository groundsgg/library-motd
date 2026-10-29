import { setLabelText, setLabelAttribute } from "../localization.js";
import type { GradientStop, TextStyle } from "../../core/model.js";
import { element } from "../render.js";
import {
  activeStyle,
  fieldEditable,
  toolButton,
  toolField,
  toolLabel,
  toolLocked,
} from "./ui.js";
import type { ToolMount, ToolHandle, TextToolRequest } from "./tool-types.js";
import type { EditableField } from "./types.js";

export function mountTextTools(mount: ToolMount): ToolHandle {
  const { root, controller, overlays } = mount,
    doc = root.ownerDocument;
  let destroyed = false;
  let activeField: EditableField | undefined;
  function open(request: TextToolRequest) {
    const { tool, anchor, selection } = request;
    if (tool === "sprite") return;
    if (destroyed || !fieldEditable(mount, selection.field)) return;
    activeField = selection.field;
    const content = element(doc, "section", "mce-tool-content"),
      status = element(doc, "div", "mce-tool-status");
    status.role = "status";
    const name = toolLabel(
      mount,
      tool,
      tool === "color"
        ? "Text color"
        : tool === "gradient"
          ? "Gradient"
          : tool === "placeholder"
            ? "Insert placeholder"
            : tool === "rainbow"
              ? "Rainbow"
              : "More formatting",
    );
    const heading = element(doc, "div", "mce-tool-heading");
    heading.append(element(doc, "strong", "", name));
    heading.append(
      toolButton(doc, "✕", toolLabel(mount, "close", "Close"), () =>
        overlays.close("dismiss"),
      ),
    );
    content.append(heading);
    function editSelection(action: () => void) {
      if (
        !fieldEditable(mount, selection.field) ||
        !controller.restoreSelection(selection)
      ) {
        setLabelText(
          status,
          toolLabel(
            mount,
            "selectionExpired",
            "The selection is no longer available.",
          ),
        );
        return;
      }
      const active = doc.activeElement as HTMLElement | null;
      action();
      if (active?.isConnected && content.contains(active)) active.focus();
    }
    function apply(style: TextStyle) {
      editSelection(() =>
        controller.execute({ type: "format", field: selection.field, style }),
      );
    }
    if (tool === "color") {
      const swatch = element(doc, "input", "mce-tool-color"),
        hex = element(doc, "input", "");
      swatch.type = "color";
      hex.type = "text";
      hex.maxLength = 7;
      const current = activeStyle(mount).color ?? "#ffaa00";
      swatch.value = hex.value = current;
      let applied = "";
      const change = (value: string) => {
        if (!/^#[\da-f]{6}$/i.test(value)) return;
        swatch.value = hex.value = value;
        if (applied === value) return;
        applied = value;
        apply({ color: value });
      };
      swatch.addEventListener("input", () => change(swatch.value));
      hex.addEventListener("input", () => change(hex.value));
      content.append(
        toolField(doc, toolLabel(mount, "colorPicker", "Color picker"), swatch),
        toolField(doc, toolLabel(mount, "hexColor", "Hex color"), hex),
      );
    } else if (tool === "gradient") {
      const current = activeStyle(mount),
        stops: GradientStop[] = structuredClone(
          current.gradient ?? [
            { color: "#ff0000", position: 0 },
            { color: "#0000ff", position: 1 },
          ],
        );
      const fields = element(doc, "div", "mce-gradient-stops"),
        phase = element(doc, "input", "");
      phase.type = "number";
      phase.min = "-1";
      phase.max = "1";
      phase.step = "0.1";
      phase.value = String(current.gradientPhase ?? 0);
      let applied = "";
      const applyGradient = () => {
        const sorted = [...stops].sort((a, b) => a.position - b.position),
          n = Number(phase.value);
        if (
          stops.length < 2 ||
          sorted.some(
            (s, i) =>
              !Number.isFinite(s.position) ||
              s.position < 0 ||
              s.position > 1 ||
              (i > 0 && s.position === sorted[i - 1]!.position),
          ) ||
          !Number.isFinite(n) ||
          n < -1 ||
          n > 1
        ) {
          setLabelText(
            status,
            toolLabel(
              mount,
              "invalidGradient",
              "Use distinct stop positions between 0 and 1.",
            ),
          );
          return;
        }
        setLabelText(status, "");
        const signature = JSON.stringify([sorted, n]);
        if (signature === applied) return;
        applied = signature;
        apply({ gradient: sorted, ...(n ? { gradientPhase: n } : {}) });
      };
      const renderStops = () => {
        fields.replaceChildren();
        stops.forEach((stop, index) => {
          const row = element(doc, "div", "mce-stop-row"),
            color = element(doc, "input", "mce-tool-color"),
            position = element(doc, "input", "");
          color.type = "color";
          color.value = stop.color;
          position.type = "number";
          position.min = "0";
          position.max = "1";
          position.step = "0.05";
          position.value = String(stop.position);
          color.addEventListener("input", () => {
            stop.color = color.value;
            applyGradient();
          });
          position.addEventListener("input", () => {
            stop.position = Number(position.value);
            applyGradient();
          });
          row.append(
            toolField(
              doc,
              toolLabel(mount, "gradientColorNumber", "{label} {index}", {
                label: toolLabel(mount, "gradientColor", "Gradient color"),
                index: index + 1,
              }),
              color,
            ),
            toolField(
              doc,
              toolLabel(mount, "gradientPositionNumber", "{label} {index}", {
                label: toolLabel(
                  mount,
                  "gradientPosition",
                  "Gradient position",
                ),
                index: index + 1,
              }),
              position,
            ),
          );
          const remove = toolButton(
            doc,
            "−",
            toolLabel(mount, "removeStopNumber", "{label} {index}", {
              label: toolLabel(mount, "removeStop", "Remove stop"),
              index: index + 1,
            }),
            () => {
              stops.splice(index, 1);
              renderStops();
              applyGradient();
            },
          );
          remove.disabled = stops.length <= 2;
          row.append(remove);
          fields.append(row);
        });
      };
      renderStops();
      content.append(
        fields,
        toolField(
          doc,
          toolLabel(mount, "gradientPhase", "Gradient phase"),
          phase,
        ),
      );
      phase.addEventListener("input", applyGradient);
      content.append(
        toolButton(
          doc,
          toolLabel(mount, "addStopButton", "+ {label}", {
            label: toolLabel(mount, "addStop", "Add color stop"),
          }),
          toolLabel(mount, "addStop", "Add color stop"),
          () => {
            const sorted = [...stops].sort((a, b) => a.position - b.position);
            let gap = 0,
              position = 0.5;
            for (let i = 1; i < sorted.length; i++) {
              const delta = sorted[i]!.position - sorted[i - 1]!.position;
              if (delta > gap) {
                gap = delta;
                position = sorted[i - 1]!.position + delta / 2;
              }
            }
            stops.push({ color: "#ffffff", position });
            renderStops();
            applyGradient();
          },
        ),
      );
    } else if (tool === "placeholder") {
      const input = element(doc, "input", "");
      input.type = "text";
      setLabelAttribute(input, "placeholder", "players");
      input.pattern = "[\\w.-]+";
      content.append(
        toolField(
          doc,
          toolLabel(mount, "placeholderName", "Placeholder name"),
          input,
        ),
      );
      const choices = element(doc, "div", "mce-placeholder-choices");
      const insert = (name: string) => {
        if (!/^[\w.-]+$/.test(name)) return;
        if (toolLocked(mount)) return;
        controller.insertPlaceholder(name, selection);
        overlays.close("apply");
      };
      for (const key of new Set([
        "players",
        "max",
        ...Object.keys(controller.getOptions().context.values),
      ]))
        choices.append(toolButton(doc, `{{${key}}}`, key, () => insert(key)));
      content.append(
        choices,
        toolButton(
          doc,
          toolLabel(mount, "insert", "Insert"),
          toolLabel(mount, "insert", "Insert"),
          () => insert(input.value.trim()),
        ),
      );
    } else if (tool === "rainbow") {
      const phase = element(doc, "input", ""),
        reversed = element(doc, "input", "");
      phase.type = "number";
      phase.step = "1";
      phase.value = String(activeStyle(mount).rainbow?.phase ?? 0);
      reversed.type = "checkbox";
      reversed.checked = activeStyle(mount).rainbow?.reversed ?? false;
      const change = () => {
        const value = Number(phase.value);
        if (Number.isFinite(value))
          apply({ rainbow: { phase: value, reversed: reversed.checked } });
      };
      phase.addEventListener("input", change);
      reversed.addEventListener("change", change);
      content.append(
        toolField(
          doc,
          toolLabel(mount, "rainbowPhase", "Rainbow phase"),
          phase,
        ),
        toolField(
          doc,
          toolLabel(mount, "reverseRainbow", "Reverse rainbow"),
          reversed,
        ),
        toolButton(
          doc,
          toolLabel(mount, "applyRainbow", "Apply rainbow"),
          toolLabel(mount, "applyRainbow", "Apply rainbow"),
          change,
        ),
        toolButton(
          doc,
          toolLabel(mount, "removeRainbow", "Remove rainbow"),
          toolLabel(mount, "removeRainbow", "Remove rainbow"),
          () =>
            editSelection(() =>
              controller.execute({
                type: "clear-format",
                field: selection.field,
                styles: ["rainbow"],
              }),
            ),
        ),
      );
    } else {
      for (const [key, name] of [
        ["strikethrough", "Strikethrough"],
        ["obfuscated", "Obfuscation"],
      ] as const) {
        const toggle = element(doc, "input", "");
        toggle.type = "checkbox";
        toggle.checked = !!activeStyle(mount)[key];
        toggle.addEventListener("change", () =>
          apply({ [key]: toggle.checked }),
        );
        content.append(toolField(doc, toolLabel(mount, key, name), toggle));
      }
      content.append(
        toolButton(
          doc,
          toolLabel(mount, "rainbow", "Rainbow"),
          toolLabel(mount, "rainbow", "Rainbow"),
          () => open({ ...request, tool: "rainbow" }),
        ),
      );
    }
    content.append(status);
    let anchorRect: Pick<DOMRect, "left" | "bottom"> =
      anchor.getBoundingClientRect();
    overlays.open({
      id: `text:${tool}`,
      label: name,
      anchor,
      getAnchorRect() {
        if (controller.getOptions().toolbar !== "selection")
          return anchor.getBoundingClientRect();
        const view = controller.getView(selection.field);
        if (view?.dom.getClientRects().length)
          anchorRect = view.coordsAtPos(
            Math.max(
              1,
              Math.min(selection.from, view.state.doc.content.size - 1),
            ),
          );
        return anchorRect;
      },
      content,
      mode: "popover",
      onClose: (reason) => {
        if (reason !== "destroy" && reason !== "replace" && !anchor.isConnected)
          controller.focus(selection.field);
        else if (
          reason === "dismiss" ||
          reason === "cancel" ||
          reason === "apply"
        )
          controller.focus(selection.field);
      },
    });
  }
  const request = (event: Event) =>
    open((event as CustomEvent<TextToolRequest>).detail);
  root.addEventListener("mce-text-tool", request);
  const unsubscribe = controller.subscribe((event) => {
    if (
      overlays.getOpenId()?.startsWith("text:") &&
      (event === "replace" ||
        toolLocked(mount) ||
        (activeField && !fieldEditable(mount, activeField)))
    )
      overlays.close(event === "replace" ? "replace" : "cancel");
  });
  return {
    update() {},
    destroy() {
      destroyed = true;
      unsubscribe();
      root.removeEventListener("mce-text-tool", request);
      if (overlays.getOpenId()?.startsWith("text:")) overlays.close("destroy");
    },
  };
}
