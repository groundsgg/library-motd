import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { parse } from "yaml";
import { Lexer, Parser, Evaluator, data } from "@actions/expressions";

const root = fileURLToPath(new URL("../../", import.meta.url));
const workflow = parse(
  readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8"),
);
const guard = workflow.jobs.release.steps.find(
  (step) => step.name === "Ensure main is still the verified revision",
);
const release = workflow.jobs.release.steps.find(
  (step) => step.id === "release",
);
const verified = "a".repeat(40),
  newer = "b".repeat(40);
const posixOnly = { skip: process.platform === "win32" };

function expressionData(value) {
  if (typeof value === "string") return new data.StringData(value);
  return new data.Dictionary(
    ...Object.entries(value).map(([key, value]) => ({
      key,
      value: expressionData(value),
    })),
  );
}
function evaluate(expression, context) {
  const source = expression
    .trim()
    .replace(/^\$\{\{|\}\}$/g, "")
    .trim();
  const tokens = new Lexer(source).lex().tokens;
  const ast = new Parser(tokens, ["inputs", "steps", "needs"], []).parse();
  return new Evaluator(ast, expressionData(context)).evaluate().coerceString();
}
function context(current = {}, releaseOutputs = {}, tag = "") {
  return {
    inputs: { tag },
    steps: {
      current: { outputs: current },
      release: { outputs: releaseOutputs },
    },
  };
}
function publishers(ctx) {
  const publish = evaluate(workflow.jobs.release.outputs.publish, ctx);
  return ["npm", "github-packages"].map((job) =>
    evaluate(workflow.jobs[job].if, {
      needs: { release: { outputs: { publish } } },
    }),
  );
}
function runGuard(
  t,
  {
    current = newer,
    expected = verified,
    apiStatus = "0",
    badOutput = false,
  } = {},
) {
  const directory = mkdtempSync(path.join(tmpdir(), "motd-verified-main-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(
    path.join(directory, "gh"),
    `#!/usr/bin/env node
const expected=['api','repos/groundsgg/library-motd/commits/main','--jq','.sha'];
if(JSON.stringify(process.argv.slice(2))!==JSON.stringify(expected)) process.exit(99);
process.stdout.write(process.env.MOTD_PROBE_MAIN+'\\n');
process.exit(Number(process.env.MOTD_PROBE_API_STATUS));
`,
    { mode: 0o755 },
  );
  const output = path.join(directory, "output");
  if (badOutput) mkdirSync(output);
  const result = spawnSync(
    "bash",
    ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", guard.run],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 5000,
      env: {
        ...process.env,
        PATH: directory + path.delimiter + process.env.PATH,
        BASH_ENV: "",
        GH_TOKEN: "fixture-only",
        GITHUB_TOKEN: "fixture-only",
        GITHUB_REPOSITORY: "groundsgg/library-motd",
        VERIFIED_SHA: expected,
        GITHUB_OUTPUT: output,
        MOTD_PROBE_MAIN: current,
        MOTD_PROBE_API_STATUS: apiStatus,
      },
    },
  );
  assert.equal(result.error, undefined);
  const outputs =
    !badOutput && existsSync(output)
      ? Object.fromEntries(
          readFileSync(output, "utf8")
            .trim()
            .split("\n")
            .filter(Boolean)
            .map((line) => line.split("=")),
        )
      : {};
  return { ...result, outputs };
}

test(
  "an obsolete verified main run succeeds but cannot run release or publication",
  posixOnly,
  (t) => {
    const result = runGuard(t);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.outputs.current, "false");
    const ctx = context(result.outputs);
    assert.equal(evaluate(release.if, ctx), "false");
    assert.deepEqual(publishers(ctx), ["false", "false"]);
  },
);

test(
  "a current verified main run can update the release PR without publishing",
  posixOnly,
  (t) => {
    const result = runGuard(t, { current: verified });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.outputs.current, "true");
    const ctx = context(result.outputs);
    assert.equal(evaluate(release.if, ctx), "true");
    assert.deepEqual(publishers(ctx), ["false", "false"]);
  },
);

test(
  "a failed main API query remains a failure even with matching SHA output",
  posixOnly,
  (t) => {
    const result = runGuard(t, { current: verified, apiStatus: "7" });
    assert.notEqual(result.status, 0);
    assert.equal(result.outputs.current, undefined);
    assert.equal(evaluate(release.if, context(result.outputs)), "false");
  },
);

for (const [name, options] of [
  ["empty verified revision", { expected: "" }],
  ["malformed verified revision", { expected: "main" }],
  ["empty current revision", { current: "" }],
  ["malformed current revision", { current: "private-token" }],
  ["both revisions empty", { expected: "", current: "" }],
  ["unwritable output", { current: verified, badOutput: true }],
]) {
  test(`release guard fails closed for ${name}`, posixOnly, (t) => {
    const result = runGuard(t, options);
    assert.notEqual(result.status, 0);
    assert.equal(result.outputs.current, undefined);
    assert.deepEqual(publishers(context(result.outputs)), ["false", "false"]);
  });
}

for (const current of [{}, { current: "false" }])
  test(`publication requires current verification even if release-created is true: ${JSON.stringify(current)}`, () => {
    const ctx = context(current, {
      release_created: "true",
      tag_name: "v0.4.0",
    });
    assert.equal(evaluate(release.if, ctx), "false");
    assert.deepEqual(publishers(ctx), ["false", "false"]);
  });

test("only a created release on the current verified revision enables normal publication", () => {
  const ctx = context(
    { current: "true" },
    { release_created: "true", tag_name: "v0.4.0" },
  );
  assert.equal(evaluate(release.if, ctx), "true");
  assert.equal(evaluate(workflow.jobs.release.outputs.tag, ctx), "v0.4.0");
  assert.deepEqual(publishers(ctx), ["true", "true"]);
});

test("explicit recovery tags keep their separate validated publication path", () => {
  const ctx = context({}, {}, "v0.3.0");
  assert.equal(evaluate(guard.if, ctx), "false");
  assert.equal(evaluate(release.if, ctx), "false");
  assert.equal(evaluate(workflow.jobs.release.outputs.tag, ctx), "v0.3.0");
  assert.deepEqual(publishers(ctx), ["true", "true"]);
});

test(
  "release-created still requires the post-action SHA to match the tested artifact",
  posixOnly,
  () => {
    const check = workflow.jobs.release.steps.find(
      (step) => step.name === "Check release revision",
    );
    assert.equal(
      evaluate(check.if, context({}, { release_created: "true" })),
      "true",
    );
    for (const sha of [verified, newer]) {
      const result = spawnSync("bash", ["-e", "-c", check.run], {
        encoding: "utf8",
        env: {
          ...process.env,
          BASH_ENV: "",
          VERIFIED_SHA: verified,
          RELEASE_SHA: sha,
        },
      });
      assert.equal(result.error, undefined);
      assert.equal(result.status, sha === verified ? 0 : 1);
    }
  },
);
