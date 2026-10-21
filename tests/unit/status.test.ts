import { expect, it } from "vitest";
import * as core from "../../src/index.js";
const context = {
  base: {
    version: { protocol: 767, name: "1.21.1" },
    players: {
      online: 42,
      max: 500,
      sample: [{ name: "Ada", id: "00000000-0000-0000-0000-000000000001" }],
    },
    description: "",
  },
  clientProtocol: 767,
  values: {},
};
const document = () =>
  core.createDocument(
    core.parseText("{{players}}/{{max}}", "minimessage").value!,
  );
it("uses the displayed numbers in placeholders and supports headroom", () => {
  const doc = document();
  doc.players.maximum = { mode: "headroom", value: 10 };
  const result = core.evaluateStatus(doc, context);
  expect(result.value?.players).toMatchObject({ online: 42, max: 52 });
  expect(
    core
      .flattenText(
        core.parseText(JSON.stringify(result.value!.description), "json")
          .value!,
      )
      .map((c) => c.text)
      .join(""),
  ).toBe("42/52");
});
it("keeps automatic versions, honors compatibility overrides and allows forced version text", () => {
  const doc = document();
  expect(core.evaluateStatus(doc, context).value?.version).toEqual(
    context.base.version,
  );
  doc.version = {
    mode: "when-incompatible",
    text: core.parseText("<red>Update please", "minimessage").value!,
  };
  expect(core.evaluateStatus(doc, context).value?.version.name).toBe("1.21.1");
  expect(
    core.evaluateStatus(doc, { ...context, compatible: false }).value?.version
      .name,
  ).toContain("Update please");
  doc.version.mode = "always";
  expect(core.evaluateStatus(doc, context).value?.version.protocol).not.toBe(
    767,
  );
});
it("omits hidden players and reports unreachable custom hover", () => {
  const doc = document();
  doc.players.hidden = true;
  doc.hover = {
    mode: "custom",
    text: core.parseText("Hello", "minimessage").value!,
  };
  const result = core.evaluateStatus(doc, context);
  expect(result.value?.players).toBeUndefined();
  expect(result.diagnostics.some((d) => d.code === "hidden-hover")).toBe(true);
});
it("does not invent missing base counts and excludes sources from wire templates", () => {
  const doc = document();
  const { players, ...base } = context.base;
  expect(
    core.evaluateStatus(doc, { ...context, base }).value?.players,
  ).toBeUndefined();
  doc.players.maximum = { mode: "headroom", value: 10 };
  expect(core.evaluateStatus(doc, { ...context, base }).value).toBeNull();
  const template = core.compileStatusTemplate(document()).value!;
  expect(template.motd.text).not.toHaveProperty("source");
  expect(template).not.toHaveProperty("extensions");
});
it("serializes independent hover lines with their inherited starting colors", () => {
  const doc = document();
  doc.hover = {
    mode: "custom",
    text: core.parseText("<red>first<newline>second", "minimessage").value!,
  };
  const result = core.evaluateStatus(doc, context);
  expect(result.value?.players?.sample[1]?.name).toContain("§c");
});
