import { isVariableName, listVariables } from "../../core/text/variables.js";
import { element } from "../render.js";
import {
  setLabelText,
  setLabelAttribute,
  type LabelParameters,
} from "../localization.js";
import { fieldEditable, toolButton, toolField, toolLabel } from "./ui.js";
import type { FieldSelection } from "./controller.js";
import type { ToolHandle, ToolMount, TextToolRequest } from "./tool-types.js";
import type { EditableField } from "./types.js";

export function mountVariableTool(mount: ToolMount): ToolHandle {
  const { root, controller, overlays } = mount,
    doc = root.ownerDocument;
  const label = (key: string, fallback: string, parameters?: LabelParameters) =>
    toolLabel(mount, key, fallback, parameters);
  const enabled = () => controller.getOptions().features?.variables !== false;
  const textKey = (field: EditableField) => {
    const document = controller.getDocument();
    const text =
      field === "motd"
        ? document.motd.text
        : field === "version" && document.version.mode !== "automatic"
          ? document.version.text
          : field === "hover" && document.hover.mode === "custom"
            ? document.hover.text
            : null;
    return JSON.stringify(text);
  };
  let destroyed = false;
  let active: {
    field: EditableField;
    generation: number;
    text: string;
    refresh(): void;
  } | null = null;
  const entryButton = toolButton(
    doc,
    label("variables", "Variables"),
    label("variables", "Variables"),
    () => open(entryButton, controller.captureSelection()),
  );
  entryButton.addEventListener("mousedown", (event) => event.preventDefault());
  root.querySelector(".mce-entry-actions")!.append(entryButton);

  function open(anchor: HTMLElement, selection: FieldSelection | null) {
    if (destroyed || !enabled() || controller.getOptions().disabled) return;
    const field = selection?.field ?? controller.getActiveField(),
      content = element(doc, "section", "mce-tool-content mce-variable-picker"),
      heading = element(doc, "div", "mce-tool-heading"),
      title = label("placeholder", "Insert placeholder"),
      search = element(doc, "input", ""),
      name = element(doc, "input", ""),
      list = element(doc, "div", "mce-variable-list"),
      empty = element(
        doc,
        "p",
        "mce-tool-hint",
        label("variablesEmpty", "No variables are listed for this field."),
      ),
      more = element(
        doc,
        "p",
        "mce-tool-hint",
        label(
          "variablesMore",
          "More matches are available. Narrow the search.",
        ),
      ),
      hint = element(doc, "p", "mce-tool-hint"),
      status = element(doc, "div", "mce-tool-status");
    status.role = "status";
    search.type = "search";
    search.maxLength = 256;
    name.type = "text";
    name.maxLength = 128;
    name.pattern = "[A-Za-z0-9_.\\-]+";
    setLabelAttribute(name, "placeholder", "custom.name");
    heading.append(
      element(doc, "strong", "", title),
      toolButton(doc, "✕", label("close", "Close"), () =>
        overlays.close("dismiss"),
      ),
    );
    const canInsert = () =>
      enabled() && !!selection && fieldEditable(mount, field);
    const entries = () =>
      listVariables(controller.getVariableValues(), {
        catalog: controller.getOptions().variableCatalog,
        field,
      });
    const insert = (value: string, listed: boolean) => {
      if (active !== session || overlays.getOpenId() !== "variables") return;
      if (!canInsert() || !selection || !isVariableName(value)) return;
      if (listed && !entries().some((entry) => entry.name === value)) return;
      if (!controller.restoreSelection(selection)) {
        setLabelText(
          status,
          label("selectionExpired", "The selection is no longer available."),
        );
        return;
      }
      if (controller.insertPlaceholder(value, selection))
        overlays.close("apply");
      else
        setLabelText(
          status,
          label(
            "variableInsertFailed",
            "The variable could not be inserted at this position.",
          ),
        );
    };
    const submit = toolButton(
      doc,
      label("insert", "Insert"),
      label("insert", "Insert"),
      () => insert(name.value.trim(), false),
    );
    const updateName = () => {
      const value = name.value.trim();
      name.disabled = !canInsert();
      submit.disabled = !canInsert() || !isVariableName(value);
      setLabelText(
        hint,
        !canInsert()
          ? label(
              "variablesReadOnly",
              "You can inspect variables here. Editing is unavailable.",
            )
          : value && !isVariableName(value)
            ? label(
                "variableInvalidName",
                "Use letters, numbers, underscores, dots or hyphens (up to 128 characters).",
              )
            : value && !entries().some((entry) => entry.name === value)
              ? label(
                  "variableNotListed",
                  "This name is not listed for this field. Check which variables your host supports.",
                )
              : label(
                  "variablesPreviewOnly",
                  "Preview values and examples are display information; the saved document keeps the variable name.",
                ),
      );
    };
    let signature = "";
    const render = (force = false) => {
      const values = controller.getVariableValues(),
        catalog = entries();
      const next = JSON.stringify([catalog, values, canInsert(), search.value]);
      updateName();
      if (!force && signature === next) return;
      signature = next;
      const previous = doc.activeElement as HTMLElement | null,
        focused =
          previous && list.contains(previous)
            ? previous.dataset.variableName
            : undefined;
      list.replaceChildren();
      const query = search.value.trim().toLocaleLowerCase();
      const matches = catalog.filter((entry) =>
        `${entry.name} ${entry.label ?? ""} ${entry.description ?? ""}`
          .toLocaleLowerCase()
          .includes(query),
      );
      for (const entry of matches.slice(0, 60)) {
        const displayName = entry.label
          ? `${entry.label} (${entry.name})`
          : entry.name;
        const button = toolButton(doc, "", displayName, () =>
          insert(entry.name, true),
        );
        button.classList.add("mce-variable-choice");
        button.dataset.variableName = entry.name;
        button.disabled = !canInsert();
        if (entry.label) button.append(element(doc, "strong", "", entry.label));
        button.append(
          element(doc, "code", "mce-variable-name", `{{${entry.name}}}`),
        );
        if (entry.description)
          button.append(
            element(doc, "span", "mce-variable-description", entry.description),
          );
        const preview = Object.hasOwn(values, entry.name)
          ? label("variablePreviewValue", "Preview: {value}", {
              value: values[entry.name]!,
            })
          : label("variableNoPreview", "No preview value supplied");
        button.append(element(doc, "small", "mce-variable-value", preview));
        if (entry.exampleValue !== undefined)
          button.append(
            element(
              doc,
              "small",
              "mce-variable-value",
              label("variableExampleValue", "Example: {value}", {
                value: entry.exampleValue,
              }),
            ),
          );
        if (entry.description)
          setLabelAttribute(button, "aria-description", entry.description);
        list.append(button);
      }
      setLabelText(
        empty,
        catalog.length
          ? label("variablesNoMatches", "No matching variables.")
          : label("variablesEmpty", "No variables are listed for this field."),
      );
      empty.hidden = !!matches.length;
      more.hidden = matches.length <= 60;
      if (focused) {
        const replacement = Array.from(
          list.querySelectorAll<HTMLButtonElement>("button"),
        ).find((button) => button.dataset.variableName === focused);
        if (replacement && !replacement.disabled) replacement.focus();
        else search.focus();
      }
    };
    content.append(
      heading,
      element(
        doc,
        "p",
        "mce-tool-hint",
        label("variableScope", "Field: {field}", {
          field:
            field === "motd"
              ? label("variableFieldMotd", "MOTD")
              : field === "version"
                ? label("variableFieldVersion", "Version text")
                : label("variableFieldHover", "Player hover"),
        }),
      ),
      toolField(doc, label("searchVariables", "Search variables"), search),
      list,
      empty,
      more,
      toolField(doc, label("placeholderName", "Placeholder name"), name),
      hint,
      submit,
      status,
    );
    name.addEventListener("input", updateName);
    name.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        insert(name.value.trim(), false);
      }
    });
    search.addEventListener("input", () => render());
    const session = {
      field,
      generation: controller.getGeneration(),
      text: textKey(field),
      refresh: () => render(),
    };
    active = session;
    render(true);
    let anchorRect: Pick<DOMRect, "left" | "bottom"> =
      anchor.getBoundingClientRect();
    overlays.open({
      id: "variables",
      label: title,
      anchor,
      content,
      mode: "popover",
      getAnchorRect() {
        if (
          anchor === entryButton ||
          controller.getOptions().toolbar !== "selection"
        )
          return anchor.getBoundingClientRect();
        const view = controller.getView(field);
        if (selection && view?.dom.getClientRects().length)
          anchorRect = view.coordsAtPos(
            Math.max(
              1,
              Math.min(selection.from, view.state.doc.content.size - 1),
            ),
          );
        return anchorRect;
      },
      onClose(reason) {
        if (selection) controller.releaseSelection(selection);
        if (active === session) active = null;
        if (["dismiss", "cancel", "apply"].includes(reason) && canInsert())
          controller.focus(field);
      },
    });
    search.focus();
  }
  const request = (event: Event) => {
    const detail = (event as CustomEvent<TextToolRequest>).detail;
    if (detail.tool === "placeholder") open(detail.anchor, detail.selection);
  };
  root.addEventListener("mce-text-tool", request);
  function update() {
    if (destroyed) return;
    entryButton.hidden = !enabled();
    entryButton.disabled = !!controller.getOptions().disabled;
    setLabelText(entryButton, label("variables", "Variables"));
    setLabelAttribute(
      entryButton,
      "aria-label",
      label("variables", "Variables"),
    );
    setLabelAttribute(entryButton, "title", label("variables", "Variables"));
    if (active && overlays.getOpenId() === "variables") {
      if (
        !enabled() ||
        controller.getOptions().disabled ||
        active.generation !== controller.getGeneration() ||
        active.text !== textKey(active.field)
      )
        overlays.close("replace");
      else active.refresh();
    }
  }
  update();
  return {
    update,
    destroy() {
      destroyed = true;
      root.removeEventListener("mce-text-tool", request);
      if (overlays.getOpenId() === "variables") overlays.close("destroy");
      active = null;
      entryButton.remove();
    },
  };
}
