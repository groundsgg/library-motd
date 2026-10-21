import { expect, it } from "vitest";
import {
  parseText,
  serializeText,
  java1211Profile,
  type TextDocument,
} from "../../src/index.js";
const layout = {
  profile: java1211Profile,
  width: 271,
  alignments: ["center" as const],
};
it("preserves dynamic placeholder tokens through aligned and uneven-gradient MiniMessage export", () => {
  const text = parseText("Online {{players}}", "minimessage").value!;
  expect(
    serializeText(text, { format: "minimessage" }, { layout }).value,
  ).toContain("{{players}}");
  const gradient = parseText(
    "<gradient:#ff0000:#00ff00:#0000ff>{{players}} online</gradient>",
    "minimessage",
  ).value!;
  const group = gradient.nodes[0];
  if (group.type === "group") group.style.gradient![1]!.position = 0.2;
  gradient.revision++;
  expect(serializeText(gradient, { format: "minimessage" }).value).toContain(
    "{{players}}",
  );
});
it("preserves protected native MiniMessage raw subtrees when aligning", () => {
  const raw = "<click:run_command:'/test'>Click me</click>";
  const text = parseText(raw + " neighbour", "minimessage").value!;
  text.revision++;
  expect(
    serializeText(text, { format: "minimessage" }, { layout }).value,
  ).toContain(raw);
});
it("keeps same-format opaque JSON objects and descendants after a neighbour edit", () => {
  const raw = {
    text: "Click",
    clickEvent: { action: "run_command", value: "/test" },
    extra: [{ text: " child" }],
  };
  const text = parseText(
    JSON.stringify({ text: "", extra: [raw, { text: " old" }] }),
    "json",
  ).value!;
  text.revision++;
  text.nodes.push({ id: "added", type: "text", value: " new" });
  const result = serializeText(text, { format: "json" });
  expect(result.value).not.toBeNull();
  expect(result.value).toContain("clickEvent");
  expect(result.value).toContain(" child");
  expect(result.value).toContain("/test");
});
