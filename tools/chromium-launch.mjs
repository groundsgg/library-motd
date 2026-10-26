// Playwright 1.64.1's complete default list. Keep it until the stable release
// includes https://github.com/microsoft/playwright/pull/43605, then remove this
// workaround. A real-browser test checks that no default feature is lost.
const disabledFeatures = [
  "AvoidUnnecessaryBeforeUnloadCheckSync",
  "DestroyProfileOnBrowserClose",
  "DialMediaRouteProvider",
  "GlobalMediaControls",
  "HttpsUpgrades",
  "LensOverlay",
  "MediaRouter",
  "PaintHolding",
  "ThirdPartyStoragePartitioning",
  "BlockOriginHeaderModificationOnRedirect",
  "AvoidCorsURLLoaderRestartOnRedirect",
  "Translate",
  "AutoDeElevate",
  "OptimizationHints",
  "NetworkTimeServiceQuerying",
  "AimEnabled",
  "msForceBrowserSignIn",
  "msEdgeUpdateLaunchServicesPreferredVersion",
];

export function chromiumLaunchOptions(
  platform = process.platform,
  executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
) {
  const executable = executablePath ? { executablePath } : {};
  if (platform !== "win32") return executablePath ? executable : undefined;
  const original = `--disable-features=${disabledFeatures.join(",")}`;
  return {
    ...executable,
    ignoreDefaultArgs: [original],
    args: [`${original},TcpPortRandomizationWin`],
  };
}
