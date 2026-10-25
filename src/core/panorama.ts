import type { PanoramaPose, PanoramaSource } from "./model.js";

const finite = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
const wrap = (degrees: number): number => (((degrees % 360) + 540) % 360) - 180;

/** Native-speed accumulated time; callers own pause and speed integration. No DOM. */
export function panoramaPose(elapsedMs: number, initialYaw = 0): PanoramaPose {
  return {
    yaw: wrap(wrap(finite(initialYaw, 0)) + wrap(-finite(elapsedMs, 0) / 500)),
    pitch: 10,
    verticalFov: 85,
  };
}

export interface ResolvedPanorama {
  source: PanoramaSource;
  speed: number;
  paused: boolean;
  initialYaw: number;
  blur: number;
  dimming: number;
}

/** Private runtime guard: malformed host data stays on the static background path. */
export function resolvePanorama(raw: unknown): ResolvedPanorama | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const background = raw as Record<string, unknown>,
    panorama = background.panorama;
  if (!panorama || typeof panorama !== "object" || Array.isArray(panorama))
    return null;
  const source = panorama as Record<string, unknown>,
    faces = source.faces;
  if (
    !Array.isArray(faces) ||
    faces.length !== 6 ||
    !faces.every((url) => typeof url === "string" && url.trim().length)
  )
    return null;
  const motion =
    background.motion && typeof background.motion === "object"
      ? (background.motion as Record<string, unknown>)
      : {};
  const optionalUrl = (value: unknown) =>
    typeof value === "string" && value.trim() ? value : undefined;
  return {
    source: {
      faces: [faces[0], faces[1], faces[2], faces[3], faces[4], faces[5]],
      fallbackImageUrl: optionalUrl(source.fallbackImageUrl),
      overlayImageUrl: optionalUrl(source.overlayImageUrl),
    },
    speed: clamp(finite(motion.speed, 1), -10, 10),
    paused: motion.paused === true,
    initialYaw: wrap(finite(motion.initialYaw, 0)),
    blur: clamp(finite(background.blur, 5), 0, 32),
    dimming: clamp(finite(background.dimming, 1 / 3), 0, 1),
  };
}
