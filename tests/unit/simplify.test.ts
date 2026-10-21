import { expect, it } from "vitest";
import * as core from "../../src/index.js";
it("suggests a gradient with retained stop positions without mutating the original", () => {
  const text = core.parseText(
    "&#ff0000A&#cc3300B&#996600C&#669900D&#33cc00E&#00ff00F&#008080G&#0000ffH",
    "legacy-ampersand",
  ).value!;
  const before = JSON.stringify(text);
  const proposal = core.suggestSimplification(text, { tolerance: 0 });
  expect(JSON.stringify(text)).toBe(before);
  expect(proposal.maximumColorError).toBe(0);
  expect(core.flattenText(proposal.candidate).map((c) => c.color)).toEqual([
    "#ff0000",
    "#cc3300",
    "#996600",
    "#669900",
    "#33cc00",
    "#00ff00",
    "#008080",
    "#0000ff",
  ]);
});
