import type { IconValue } from "../../core/model.js";
import { normalizeIcon } from "../icon.js";
import { element } from "../render.js";
import { toolButton, toolField, toolLabel, toolLocked } from "./ui.js";
import type { ToolMount, ToolHandle } from "./tool-types.js";

export function mountIconTool(mount: ToolMount): ToolHandle {
  const { root, entry, controller, overlays } = mount,
    doc = root.ownerDocument,
    icon = entry.getAnchors().icon,
    file = element(doc, "input", ""),
    loading = element(doc, "div", "mce-tool-status");
  file.type = "file";
  file.accept = "image/png,image/jpeg";
  file.hidden = true;
  loading.role = "status";
  root.append(file, loading);
  let destroyed = false,
    request = 0,
    original: File | undefined,
    bitmap: ImageBitmap | undefined,
    draft: IconValue | null | undefined,
    crop = { x: 0, y: 0, size: 64 },
    body: HTMLElement | null = null,
    apply: HTMLButtonElement | undefined,
    status: HTMLElement | undefined,
    preview: HTMLImageElement | undefined,
    canvas: HTMLCanvasElement | undefined,
    invalidated = false;
  const label = (key: string, fallback: string) =>
    toolLabel(mount, key, fallback);
  const allowed = () =>
    !destroyed &&
    !toolLocked(mount) &&
    controller.getOptions().features?.icon !== false;
  const cancelPending = toolButton(
    doc,
    label("cancelUpload", "Cancel upload"),
    label("cancelUpload", "Cancel upload"),
    () => {
      request++;
      loading.textContent = "";
      cancelPending.hidden = true;
      if (body && overlays.getOpenId() === "icon") overlays.close("cancel");
    },
  );
  cancelPending.hidden = true;
  root.append(cancelPending);
  const upload = toolButton(doc, "", "", () => {
    if (!allowed()) return;
    if (controller.getDocument().icon) open(controller.getDocument().icon);
    else file.click();
  });
  upload.className = "mce-icon-upload";
  const glyph = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  glyph.setAttribute("viewBox", "0 0 16 16");
  glyph.setAttribute("class", "mce-upload-icon");
  glyph.setAttribute("aria-hidden", "true");
  glyph.setAttribute("fill", "currentColor");
  glyph.setAttribute("shape-rendering", "crispEdges");
  for (const data of [
    "M1 3h8v1H2v10h12V8h1v7H1z",
    "M3 11h1v-1h1V9h1v1h1v1h1v1h1v-1h1v-1h1v1h1v1h1v1H3z",
    "M4 6h2v2H4z",
    "M12 1h2v2h2v2h-2v2h-2V5h-2V3h2z",
  ]) {
    const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", data);
    glyph.append(path);
  }
  upload.append(glyph);
  const caption = element(doc, "span", "");
  upload.append(caption);
  icon.append(upload);
  function release() {
    request++;
    bitmap?.close();
    bitmap = undefined;
    original = undefined;
    body = null;
    draft = undefined;
    loading.textContent = "";
    cancelPending.hidden = true;
  }
  function invalidate() {
    request++;
    bitmap?.close();
    bitmap = undefined;
    original = undefined;
    invalidated = true;
    loading.textContent = "";
    cancelPending.hidden = true;
    if (body && overlays.getOpenId() === "icon") {
      status!.textContent = label(
        "draftInvalidated",
        "The document changed. This draft can no longer be applied. Close and reopen the tool.",
      );
      for (const control of body.querySelectorAll<
        HTMLInputElement | HTMLButtonElement
      >("input,button"))
        if (control.dataset.cancel !== "true") control.disabled = true;
    }
  }
  function draw() {
    if (!canvas || !bitmap) return;
    const g = canvas.getContext("2d")!;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const scale = canvas.width / bitmap.width;
    g.strokeStyle = "#ffffff";
    g.lineWidth = 2;
    g.strokeRect(
      crop.x * scale,
      crop.y * scale,
      crop.size * scale,
      crop.size * scale,
    );
  }
  function showPreview() {
    if (!preview) return;
    preview.hidden = !draft;
    if (draft) preview.src = "data:image/png;base64," + draft.pngBase64;
    else preview.removeAttribute("src");
  }
  async function recrop() {
    if (!original || !allowed() || invalidated) return;
    const token = ++request,
      source = original;
    apply!.disabled = true;
    draw();
    const result = await normalizeIcon(source, {
      crop: { x: crop.x, y: crop.y, width: crop.size, height: crop.size },
    });
    if (token !== request || !allowed() || invalidated || !body) return;
    draft = result.value ?? undefined;
    status!.textContent = result.diagnostics.map((d) => d.message).join("\n");
    apply!.disabled = draft === undefined;
    showPreview();
  }
  function open(value: IconValue | null | undefined, error = "") {
    if (!allowed()) return;
    // Close another primary tool before installing this draft's references.
    overlays.close("dismiss");
    invalidated = false;
    draft = value;
    body = element(doc, "div", "mce-tool-content");
    const heading = element(doc, "div", "mce-tool-heading"),
      title = label("iconEditor", "Server icon editor");
    heading.append(element(doc, "strong", "", title));
    status = element(doc, "div", "mce-tool-status", error);
    status.role = "status";
    preview = element(doc, "img", "mce-icon-preview");
    preview.alt = label("iconPreview", "Icon crop preview");
    canvas = element(doc, "canvas", "mce-crop-canvas");
    if (bitmap) {
      const ratio = Math.min(480 / bitmap.width, 300 / bitmap.height);
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    }
    canvas.hidden = !bitmap;
    const choose = toolButton(
      doc,
      label("chooseImage", "Choose image"),
      label("chooseImage", "Choose image"),
      () => {
        if (allowed() && !invalidated) file.click();
      },
    );
    body.append(heading, choose, canvas, preview);
    if (bitmap) {
      const fields = element(doc, "div", "mce-crop-fields"),
        controls = new Map<string, HTMLInputElement>();
      for (const key of ["x", "y", "size"] as const) {
        const input = element(doc, "input", "");
        input.type = "number";
        input.value = String(crop[key]);
        input.min = key === "size" ? "1" : "0";
        controls.set(key, input);
        input.addEventListener("input", () => {
          crop[key] = Number(input.value);
          void recrop();
        });
        fields.append(
          toolField(doc, label("crop" + key, "Crop " + key), input),
        );
      }
      body.append(fields);
      let drag: { x: number; y: number; cropX: number; cropY: number } | null =
        null;
      canvas.addEventListener("pointerdown", (event) => {
        if (!allowed() || invalidated || !bitmap) return;
        drag = {
          x: event.clientX,
          y: event.clientY,
          cropX: crop.x,
          cropY: crop.y,
        };
        canvas!.setPointerCapture(event.pointerId);
      });
      canvas.addEventListener("pointermove", (event) => {
        if (!drag || !bitmap) return;
        const scale = bitmap.width / canvas!.getBoundingClientRect().width;
        crop.x = Math.round(
          Math.max(
            0,
            Math.min(
              bitmap.width - crop.size,
              drag.cropX + (event.clientX - drag.x) * scale,
            ),
          ),
        );
        crop.y = Math.round(
          Math.max(
            0,
            Math.min(
              bitmap.height - crop.size,
              drag.cropY + (event.clientY - drag.y) * scale,
            ),
          ),
        );
        controls.get("x")!.value = String(crop.x);
        controls.get("y")!.value = String(crop.y);
        draw();
      });
      const end = () => {
        if (drag) {
          drag = null;
          void recrop();
        }
      };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
    }
    const footer = element(doc, "div", "mce-tool-footer");
    const reset = toolButton(
      doc,
      label("resetIcon", "Reset icon"),
      label("resetIcon", "Reset icon"),
      () => {
        if (!allowed() || invalidated) return;
        request++;
        draft = null;
        apply!.disabled = false;
        status!.textContent = "";
        showPreview();
      },
    );
    reset.disabled = !controller.getDocument().icon;
    const cancel = toolButton(
      doc,
      label("cancel", "Cancel"),
      label("cancel", "Cancel"),
      () => overlays.close("cancel"),
    );
    cancel.dataset.cancel = "true";
    apply = toolButton(
      doc,
      label("apply", "Apply"),
      label("apply", "Apply"),
      () => {
        if (!allowed() || invalidated || draft === undefined) return;
        const next = draft;
        overlays.close("apply");
        controller.execute({ type: "set-field", field: "icon", value: next });
      },
    );
    apply.disabled = value === undefined || !original;
    footer.append(reset, cancel, apply);
    body.append(status, footer);
    showPreview();
    draw();
    overlays.open({
      id: "icon",
      label: title,
      anchor: upload,
      content: body,
      mode: "dialog",
      onClose: release,
    });
  }
  async function load(uploaded: File) {
    if (!allowed()) return;
    const token = ++request,
      generation = controller.getGeneration();
    const valid = () =>
      token === request &&
      generation === controller.getGeneration() &&
      allowed();
    loading.textContent = label("imageLoading", "Preparing image…");
    cancelPending.hidden = false;
    if (body) apply!.disabled = true;
    let image: ImageBitmap | undefined;
    try {
      const normalized = await normalizeIcon(uploaded);
      if (!valid()) return;
      if (!normalized.value) {
        if (overlays.getOpenId() === "icon") overlays.close("cancel");
        open(
          undefined,
          normalized.diagnostics.map((d) => d.message).join("\n"),
        );
        return;
      }
      image = await createImageBitmap(uploaded);
      if (!valid()) return;
      if (overlays.getOpenId() === "icon") overlays.close("cancel");
      bitmap = image;
      image = undefined;
      original = uploaded;
      const size = Math.min(bitmap.width, bitmap.height);
      crop = {
        x: Math.floor((bitmap.width - size) / 2),
        y: Math.floor((bitmap.height - size) / 2),
        size,
      };
      open(normalized.value);
    } catch {
      if (valid())
        open(undefined, label("imageError", "Invalid image: decoding failed"));
    } finally {
      image?.close();
      if (valid()) {
        loading.textContent = "";
        cancelPending.hidden = true;
      }
    }
  }
  const fileChange = () => {
    const uploaded = file.files?.[0];
    file.value = "";
    if (uploaded) void load(uploaded);
  };
  file.addEventListener("change", fileChange);
  const dragover = (event: DragEvent) => {
    if (allowed()) {
      event.preventDefault();
      event.dataTransfer!.dropEffect = "copy";
    }
  };
  const drop = (event: DragEvent) => {
    if (!allowed()) return;
    event.preventDefault();
    const uploaded = event.dataTransfer?.files[0];
    if (uploaded) void load(uploaded);
  };
  icon.addEventListener("dragover", dragover);
  icon.addEventListener("drop", drop);
  function update() {
    if (destroyed) return;
    file.disabled = !allowed();
    file.setAttribute("aria-label", label("serverIcon", "Server icon"));
    upload.hidden = !allowed();
    upload.setAttribute(
      "aria-label",
      label(
        controller.getDocument().icon ? "editIcon" : "uploadIcon",
        controller.getDocument().icon
          ? "Edit server icon"
          : "Upload server icon",
      ),
    );
    upload.title = upload.getAttribute("aria-label")!;
    caption.textContent = label(
      controller.getDocument().icon ? "edit" : "upload",
      controller.getDocument().icon ? "Edit" : "Upload",
    );
    if (!allowed()) {
      request++;
      loading.textContent = "";
      cancelPending.hidden = true;
      if (overlays.getOpenId() === "icon") overlays.close("cancel");
    }
  }
  const unsubscribe = controller.subscribe((event) => {
    if (event === "replace") invalidate();
    if (event !== "selection") update();
  });
  update();
  return {
    update,
    destroy() {
      destroyed = true;
      unsubscribe();
      if (overlays.getOpenId() === "icon") overlays.close("destroy");
      release();
      file.removeEventListener("change", fileChange);
      icon.removeEventListener("dragover", dragover);
      icon.removeEventListener("drop", drop);
      upload.remove();
      file.remove();
      loading.remove();
      cancelPending.remove();
    },
  };
}
