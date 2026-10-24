import {
  suggestImportAssistance,
  type ImportAssistanceProposal,
} from "../../core/text/import-assistance.js";
import { serializeText } from "../../core/text/serialize.js";
import type { TextDocument } from "../../core/model.js";
import { createPreview, type PreviewHandle } from "../preview.js";
import { element, entryTextWidth } from "../render.js";
import { setLabelText, type LabelParameters } from "../localization.js";
import {
  fieldEditable,
  toolButton,
  toolField,
  toolLabel,
  toolLocked,
  type EntryToolAction,
} from "./ui.js";
import type { ToolHandle, ToolMount } from "./tool-types.js";

/** Explicit review of detached proposals; never changes imported content on open. */
export function mountImportAssistance(mount: ToolMount): ToolHandle {
  const { root, controller, overlays } = mount,
    doc = root.ownerDocument;
  const label = (key: string, fallback: string, parameters?: LabelParameters) =>
    toolLabel(mount, key, fallback, parameters);
  const allowed = () =>
    !toolLocked(mount) &&
    controller.getOptions().features?.assistance !== false &&
    (["motd", "version", "hover"] as const).some((field) =>
      fieldEditable(mount, field),
    );
  const fingerprint = () => {
    const options = controller.getOptions();
    return JSON.stringify({
      document: controller.getDocument(),
      context: options.context,
      features: options.features,
      readOnly: options.readOnly,
      disabled: options.disabled,
    });
  };
  let destroyed = false;
  let active: { update(): void; destroy(): void } | null = null;

  function open() {
    if (destroyed || !allowed()) return;
    overlays.close("dismiss");
    const baseline = fingerprint(),
      provider = controller.getOptions().context.assetProvider,
      supported = controller.getOptions().context.profile.font.supported;
    let invalidated = false,
      proposals: ImportAssistanceProposal[] = [];
    const content = element(doc, "div", "mce-tool-content"),
      status = element(doc, "div", "mce-tool-status"),
      choice = element(doc, "select", ""),
      color = element(doc, "input", ""),
      position = element(doc, "input", ""),
      beforeHost = element(
        doc,
        "div",
        "mce-assistance-preview mce-assistance-before",
      ),
      afterHost = element(
        doc,
        "div",
        "mce-assistance-preview mce-assistance-after",
      ),
      originalSource = element(doc, "textarea", ""),
      suggestedSource = element(doc, "textarea", ""),
      footer = element(doc, "div", "mce-tool-footer");
    status.role = "status";
    for (const [input, max] of [
      [color, 255],
      [position, 4],
    ] as const) {
      input.type = "number";
      input.min = "0";
      input.max = String(max);
      input.step = "any";
      input.value = "0";
    }
    for (const input of [originalSource, suggestedSource]) {
      input.readOnly = true;
      input.rows = 3;
    }
    const current = controller.getDocument(),
      context = controller.getOptions().context;
    const previews: PreviewHandle[] = [beforeHost, afterHost].map((host) =>
      createPreview(host, {
        document: current,
        context: { ...context, presentation: "row", animations: false },
        labels: controller.getOptions().labels,
      }),
    );
    content.append(
      element(
        doc,
        "p",
        "",
        label(
          "assistanceHint",
          "Review a proposal before replacing colors or intentional leading spaces. Nothing changes until Apply.",
        ),
      ),
      toolField(
        doc,
        label("assistanceColorTolerance", "RGB tolerance (0–255)"),
        color,
      ),
      toolField(
        doc,
        label(
          "assistancePositionTolerance",
          "Position tolerance (0–4 GUI pixels)",
        ),
        position,
      ),
      toolField(doc, label("assistanceProposal", "Proposal"), choice),
      element(doc, "strong", "", label("assistanceBefore", "Before")),
      beforeHost,
      toolField(
        doc,
        label("assistanceOriginalSource", "Original source"),
        originalSource,
      ),
      element(doc, "strong", "", label("assistanceAfter", "Suggested")),
      afterHost,
      toolField(
        doc,
        label("assistanceSuggestedSource", "Suggested source"),
        suggestedSource,
      ),
      status,
      footer,
    );
    const selected = () => proposals[Number(choice.value)];
    const stale = () =>
      !allowed() ||
      fingerprint() !== baseline ||
      controller.getOptions().context.assetProvider !== provider ||
      controller.getOptions().context.profile.font.supported !== supported;
    const apply = toolButton(
      doc,
      label("apply", "Apply"),
      label("apply", "Apply"),
      () => {
        update();
        const proposal = selected();
        if (invalidated || !proposal || !fieldEditable(mount, proposal.field))
          return;
        overlays.close("apply");
        controller.execute({
          type: "replace-document",
          document: proposal.candidate,
        });
      },
    );
    const cancel = toolButton(
      doc,
      label("cancel", "Cancel"),
      label("cancel", "Cancel"),
      () => overlays.close("cancel"),
    );
    cancel.dataset.cancel = "true";
    footer.append(cancel, apply);

    const source = (text: TextDocument) => {
      const result = serializeText(text, {
        format:
          text.source?.revision === text.revision
            ? text.source.format
            : "minimessage",
        rgb: true,
      });
      return result.value ?? JSON.stringify(text);
    };
    const textFor = (
      proposal: ImportAssistanceProposal | undefined,
      candidate: boolean,
    ) => {
      const document = proposal
        ? candidate
          ? proposal.candidate
          : proposal.original
        : current;
      return proposal?.field === "version" &&
        document.version.mode !== "automatic"
        ? document.version.text
        : proposal?.field === "hover" && document.hover.mode === "custom"
          ? document.hover.text
          : document.motd.text;
    };
    function updatePreviews() {
      const proposal = selected(),
        options = controller.getOptions();
      previews.forEach((preview, index) =>
        preview.update({
          document: proposal
            ? index
              ? proposal.candidate
              : proposal.original
            : current,
          context: {
            ...options.context,
            presentation: "row",
            animations: false,
          },
          labels: options.labels,
        }),
      );
    }
    function update() {
      invalidated ||= stale();
      apply.disabled = invalidated || !selected();
      if (invalidated) {
        setLabelText(
          status,
          label(
            "assistanceInvalidated",
            "The document or editor configuration changed. Close and reopen assistance before applying a proposal.",
          ),
        );
        for (const control of [choice, color, position])
          control.disabled = true;
      }
      updatePreviews();
    }
    function show() {
      const proposal = selected();
      originalSource.value = source(textFor(proposal, false));
      suggestedSource.value = proposal ? source(textFor(proposal, true)) : "";
      setLabelText(
        status,
        proposal
          ? label(
              "assistanceMetrics",
              "RGB deviation: {color}; position deviation: {position} GUI px; leading spaces replaced: {spaces}.",
              {
                color: proposal.maximumColorError,
                position: proposal.maximumPositionError,
                spaces: proposal.removedPadding,
              },
            )
          : label(
              "assistanceEmpty",
              "No safe proposals at these tolerances. Protected content, existing effects and unsupported layouts are kept unchanged.",
            ),
      );
      update();
    }
    function analyze() {
      if (invalidated || stale()) {
        update();
        return;
      }
      const options = controller.getOptions();
      proposals = suggestImportAssistance(current, {
        profile: options.context.profile,
        width: entryTextWidth(options.context),
        colorTolerance: color.valueAsNumber,
        positionTolerance: position.valueAsNumber,
      }).filter((p) => fieldEditable(mount, p.field));
      choice.replaceChildren();
      for (const [index, proposal] of proposals.entries()) {
        const field = label(
          `assistanceField.${proposal.field}`,
          proposal.field === "motd"
            ? "MOTD"
            : proposal.field === "version"
              ? "Version"
              : "Hover",
        );
        const caption = label(
          `assistanceKind.${proposal.kind}`,
          proposal.kind === "gradient"
            ? "Gradient: {field}"
            : "Alignment: {field}",
          { field },
        );
        const option = element(doc, "option", "", caption);
        option.value = String(index);
        choice.append(option);
      }
      if (!proposals.length) {
        const option = element(
          doc,
          "option",
          "",
          label("assistanceNoProposal", "No proposal"),
        );
        option.value = "";
        choice.append(option);
      }
      choice.value = proposals.length ? "0" : "";
      choice.disabled = !proposals.length;
      show();
    }
    choice.addEventListener("change", show);
    color.addEventListener("input", analyze);
    position.addEventListener("input", analyze);
    const session = {
      update,
      destroy: () => {
        for (const preview of previews) preview.destroy();
      },
    };
    active = session;
    analyze();
    overlays.open({
      id: "import-assistance",
      label: label("importAssistance", "Import assistance"),
      anchor: root.querySelector<HTMLElement>("[data-entry-menu]")!,
      content,
      mode: "dialog",
      onClose: () => {
        session.destroy();
        if (active === session) active = null;
      },
    });
  }
  const menu = (event: Event) =>
    (event as CustomEvent<EntryToolAction[]>).detail.push({
      label: label("importAssistance", "Import assistance"),
      enabled: allowed(),
      action: open,
    });
  root.addEventListener("mce-entry-menu", menu);
  return {
    update() {
      active?.update();
    },
    destroy() {
      destroyed = true;
      root.removeEventListener("mce-entry-menu", menu);
      if (overlays.getOpenId() === "import-assistance")
        overlays.close("destroy");
      active?.destroy();
      active = null;
    },
  };
}
