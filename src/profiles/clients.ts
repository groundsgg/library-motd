import type { ClientProfile } from "../core/model.js";
import { java1211Profile } from "./java-1.21.1.js";

/** Native layout cases captured from the official clients; full glyph coverage remains unverified. */
export const java1204Profile: ClientProfile = {
  ...java1211Profile,
  id: "java-1.20.4",
  clientVersion: "1.20.4",
  protocol: 765,
  background: "dirt",
};
export const java12111Profile: ClientProfile = {
  ...java1211Profile,
  id: "java-1.21.11",
  clientVersion: "1.21.11",
  protocol: 774,
  geometry: {
    ...java1211Profile.geometry,
    contentWidth: 301,
    rowTop: 37,
    titleTop: 11,
    listTop: 32,
    footerHeight: 59,
    footerBottom: 7,
  },
};
/** Protocols read from the official client jars' version.json, 2026-10-21. */
export const java261Profile: ClientProfile = {
  ...java12111Profile,
  id: "java-26.1",
  clientVersion: "26.1",
  protocol: 775,
};
export const java2611Profile: ClientProfile = {
  ...java261Profile,
  id: "java-26.1.1",
  clientVersion: "26.1.1",
};
export const java2612Profile: ClientProfile = {
  ...java261Profile,
  id: "java-26.1.2",
  clientVersion: "26.1.2",
};
export const java262Profile: ClientProfile = {
  ...java261Profile,
  id: "java-26.2",
  clientVersion: "26.2",
  protocol: 776,
};
export const java263Profile: ClientProfile = {
  ...java261Profile,
  id: "java-26.3",
  clientVersion: "26.3",
  protocol: 777,
};
export const clientProfiles: readonly ClientProfile[] = [
  java1204Profile,
  java1211Profile,
  java12111Profile,
  java261Profile,
  java2611Profile,
  java2612Profile,
  java262Profile,
  java263Profile,
];
