/** Serialized by Playwright into the page; keep this function self-contained. */
export function installGraphicsObserver() {
  const original = HTMLCanvasElement.prototype.getContext;
  const events = [],
    observed = new WeakSet();
  const totals = { attempts: 0, succeeded: 0, declined: 0, lost: 0 };
  const knownCodes = [
    "FEATURE_FAILURE_WEBGL_EXHAUSTED_DRIVERS",
    "FEATURE_FAILURE_GLXTEST_FAILED",
    "FEATURE_FAILURE_GLXTEST_NO_DISPLAY",
    "FEATURE_FAILURE_EGL_LIB_INIT",
    "FEATURE_FAILURE_EGL_NO_CONFIG",
    "FEATURE_FAILURE_WEBGL_DISABLED",
    "FEATURE_FAILURE_WEBGL_UNKOWN",
    "FEATURE_FAILURE_WEBGL_SAFEMODE",
  ];
  const record = (value) => {
    events.push({ at: Math.round(performance.now()), ...value });
    if (events.length > 32) events.shift();
  };
  const rendererKind = (value) =>
    typeof value !== "string"
      ? "unknown"
      : /llvmpipe/i.test(value)
        ? "llvmpipe"
        : /softpipe/i.test(value)
          ? "softpipe"
          : "other";
  const positive = (value) =>
    Number.isSafeInteger(value) && value > 0 ? value : null;
  HTMLCanvasElement.prototype.getContext = function (api) {
    if (
      !(this instanceof HTMLCanvasElement) ||
      !["webgl", "webgl2", "experimental-webgl"].includes(api)
    ) {
      return Reflect.apply(original, this, arguments);
    }
    totals.attempts++;
    if (!observed.has(this)) {
      observed.add(this);
      this.addEventListener("webglcontextcreationerror", (event) => {
        const message =
          typeof event.statusMessage === "string"
            ? event.statusMessage.slice(0, 8192)
            : "";
        record({
          type: "creation-error",
          api,
          codes: knownCodes.filter((code) =>
            new RegExp(`\\b${code}\\b`).test(message),
          ),
          nativeGlBlocked: message.includes("WebglAllowWindowsNativeGl:false"),
          webgl2Blocked: message.includes("AllowWebgl2:false"),
        });
      });
      this.addEventListener("webglcontextlost", () => {
        totals.lost++;
        record({ type: "context-lost", api });
      });
    }
    let context;
    try {
      context = Reflect.apply(original, this, arguments);
    } catch (error) {
      record({ type: "create", api, ok: false, threw: true });
      throw error;
    }
    if (context) totals.succeeded++;
    else totals.declined++;
    const entry = { type: "create", api, ok: Boolean(context) };
    try {
      if (context) {
        entry.maxTextureSize = positive(
          context.getParameter(context.MAX_TEXTURE_SIZE),
        );
        const extension = context.getExtension("WEBGL_debug_renderer_info");
        entry.renderer = extension
          ? rendererKind(
              context.getParameter(extension.UNMASKED_RENDERER_WEBGL),
            )
          : "unknown";
      }
    } catch {
      /* The original native result is still returned unchanged. */
    }
    record(entry);
    return context;
  };
  Object.defineProperty(window, "__motdGraphicsRead", {
    value: () => ({ totals: { ...totals }, events: structuredClone(events) }),
    configurable: true,
  });
}

export function readGraphicsObserver() {
  return typeof window.__motdGraphicsRead === "function"
    ? window.__motdGraphicsRead()
    : null;
}
