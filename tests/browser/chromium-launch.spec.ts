import { chromium, expect, test } from "@playwright/test";
import config from "../../playwright.config.js";
import { chromiumLaunchOptions } from "../../tools/chromium-launch.mjs";

// Exercise the same inherited launch defaults as Windows workers on every OS.
test.use({ launchOptions: chromiumLaunchOptions("win32") });

test("Windows TCP mitigation preserves Chromium's other default feature switches", async ({
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Chromium command-line verification");
  const configured = config.projects?.find(
    (project) => project.name === "chromium",
  )?.use?.launchOptions;
  const baseline = await chromium.launch({
    executablePath: configured?.executablePath,
    ignoreDefaultArgs: false,
    args: ["--enable-automation"],
  });
  const windows = chromiumLaunchOptions("win32", configured?.executablePath);
  const candidate = await chromium.launch({
    ...windows,
    args: [...(windows?.args ?? []), "--enable-automation"],
  });
  try {
    const argumentsOf = async (browser: typeof baseline) => {
      const session = await browser.newBrowserCDPSession();
      return (await session.send("Browser.getBrowserCommandLine")).arguments;
    };
    const original = await argumentsOf(baseline);
    const actual = await argumentsOf(candidate);
    const featureSwitch = (args: string[]) =>
      args.filter((arg) => arg.startsWith("--disable-features="));
    expect(featureSwitch(original)).toHaveLength(1);
    expect(featureSwitch(actual)).toHaveLength(1);
    const originalFeatures = featureSwitch(original)[0]!
      .split("=")[1]!
      .split(",");
    const actualFeatures = featureSwitch(actual)[0]!.split("=")[1]!.split(",");
    for (const feature of originalFeatures)
      expect(actualFeatures).toContain(feature);
    // The Windows configuration must add the upstream mitigation. Other platforms
    // retain exactly the default feature list.
    expect(actualFeatures).toContain("TcpPortRandomizationWin");
    if (process.platform !== "win32") expect(configured?.args).toBeUndefined();
    const withoutDisabledFeatures = (args: string[]) =>
      args.filter(
        (arg) =>
          !arg.startsWith("--disable-features=") &&
          !arg.startsWith("--user-data-dir=") &&
          !arg.startsWith("--remote-debugging-pipe"),
      );
    expect(withoutDisabledFeatures(actual)).toEqual(
      withoutDisabledFeatures(original),
    );
  } finally {
    await candidate.close();
    await baseline.close();
  }
});
