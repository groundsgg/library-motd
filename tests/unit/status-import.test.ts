import { it, expect } from "vitest";
import { importStatus } from "../../src/index.js";
it("preserves hidden players and forced protocol text on import", () => {
  const result = importStatus({
    version: { protocol: -1, name: "§cMaintenance" },
    description: "Closed",
  });
  expect(result.value?.players.hidden).toBe(true);
  expect(result.value?.version.mode).toBe("always");
});
