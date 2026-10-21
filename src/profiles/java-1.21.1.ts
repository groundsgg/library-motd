import type { ClientProfile } from "../core/model.js";
import { advances } from "./advances.js";
/** Java geometry with locally bundled OFL glyphs. verified stays false until client capture validation. */
export const java1211Profile: ClientProfile = {
  id: "java-1.21.1",
  clientVersion: "1.21.1",
  verified: false,
  font: {
    family: "GroundsMinecraft",
    advances,
    fallbackAdvance: 6,
    boldOffset: 1,
    lineHeight: 9,
    supported: (g) => Object.hasOwn(advances, g),
  },
  geometry: {
    rowWidth: 305,
    iconSize: 32,
    iconGap: 3,
    rightInset: -1,
    lineHeight: 9,
  },
};
