import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page) {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.goto("/tests/browser/host.html");
  await page.waitForFunction(() => !!window.editor && !!window.second);
  await page.clock.pauseAt(new Date("2026-01-01T00:01:00Z"));
}

async function preview(
  page: Page,
  source = "<obfuscated>A",
  advances: Record<string, number> = { A: 6, B: 6, " ": 4 },
  modern = false,
) {
  await page.evaluate(
    ({ source, advances, modern }) => {
      const profile = modern
        ? window.api.java263Profile
        : window.api.java1211Profile;
      window.context = {
        ...window.context,
        animations: true,
        profile: { ...profile, font: { ...profile.font, advances } },
      };
      window.doc = window.api.createDocument(
        window.api.parseText(source, "minimessage").value!,
      );
      Math.random = () => 0.99;
      window.preview.update({ document: window.doc, context: window.context });
    },
    { source, advances, modern },
  );
  return page.locator("#preview .mcp-motd .mcp-glyph");
}

for (const modern of [false, true])
  test(`native ${modern ? "26.3" : "1.21.1"} obfuscation advances before the old 80ms interval`, async ({
    page,
  }) => {
    await setup(page);
    const glyph = await preview(page, "<obfuscated>A", undefined, modern);
    await expect(glyph).toHaveText("A");
    await page.clock.runFor(16);
    await expect(glyph).toHaveText("B");
    await page.evaluate(() => {
      Math.random = () => 0;
    });
    await page.clock.runFor(32);
    await expect(glyph).toHaveText("A");
  });

test("candidate classes use the non-bold ceiling and Unicode code points", async ({
  page,
}) => {
  await setup(page);
  const glyphs = await preview(page, "<obfuscated><b><i>A</i></b><newline>A", {
    A: 2.25,
    "😀": 2.75,
  });
  const geometry = await glyphs.evaluateAll((nodes) =>
    nodes.map((node) => ({
      left: (node as HTMLElement).style.left,
      top: (node as HTMLElement).style.top,
      width: (node as HTMLElement).style.width,
    })),
  );
  await page.clock.runFor(80);
  await expect(glyphs).toHaveText(["😀", "😀"]);
  expect(
    await glyphs.evaluateAll((nodes) =>
      nodes.map((node) => ({
        left: (node as HTMLElement).style.left,
        top: (node as HTMLElement).style.top,
        width: (node as HTMLElement).style.width,
      })),
    ),
  ).toEqual(geometry);
});

for (const boldOffset of [0, 0.5, 2])
  test(`custom profile bold offset ${boldOffset} retains the original regular-width candidate class`, async ({
    page,
  }) => {
    await setup(page);
    const glyphs = await preview(page, "<obfuscated><b>A</b><newline>A", {
      A: 4.25,
      "😀": 4.75,
      B: 3.5,
      C: 5.5,
    });
    await page.evaluate((boldOffset) => {
      window.context = {
        ...window.context,
        profile: {
          ...window.context.profile,
          font: {
            ...window.context.profile.font,
            family: "monospace",
            boldOffset,
          },
        },
      };
      window.preview.update({ document: window.doc, context: window.context });
    }, boldOffset);
    const before = await page.evaluate(() => ({
      source: JSON.stringify(window.doc),
      changes: window.changes.length,
    }));
    const geometry = await glyphs.evaluateAll((nodes) =>
      nodes.map((node) => ({
        left: (node as HTMLElement).style.left,
        top: (node as HTMLElement).style.top,
        width: (node as HTMLElement).style.width,
      })),
    );
    expect(geometry.map((g) => parseFloat(g.width))).toEqual([
      4.25 + boldOffset,
      4.25,
    ]);
    await page.clock.runFor(80);
    // Both source advances belong to ceiling class 5. B and C intentionally
    // belong to neighboring classes so a hardcoded bold adjustment is visible.
    await expect(glyphs).toHaveText(["😀", "😀"]);
    expect(
      await glyphs.evaluateAll((nodes) =>
        nodes.map((node) => ({
          left: (node as HTMLElement).style.left,
          top: (node as HTMLElement).style.top,
          width: (node as HTMLElement).style.width,
        })),
      ),
    ).toEqual(geometry);
    expect(
      await page.evaluate(() => ({
        source: JSON.stringify(window.doc),
        changes: window.changes.length,
      })),
    ).toEqual(before);
  });

test("bold candidate lookup preserves the original ceiling at floating-point boundaries", async ({
  page,
}) => {
  await setup(page);
  const glyphs = await preview(page, "<obfuscated><b>A</b><newline>A", {
    A: 1.0000000000000002,
    "😀": 1.75,
    B: 0.5,
  });
  await page.evaluate(() => {
    window.context.profile = {
      ...window.context.profile,
      font: {
        ...window.context.profile.font,
        family: "monospace",
        boldOffset: 2,
      },
    };
    window.preview.update({ document: window.doc, context: window.context });
  });
  await page.clock.runFor(80);
  // Adding then subtracting 2 rounds this original advance to 1, the wrong class.
  await expect(glyphs).toHaveText(["😀", "😀"]);
});

for (const useNormalized of [false, true])
  test(`bold candidate lookup shares layout ${useNormalized ? "NFC" : "fallback"} advance resolution`, async ({
    page,
  }) => {
    await setup(page);
    const glyph = await preview(
      page,
      `<obfuscated><b>${useNormalized ? "e\u0301" : "A"}</b>`,
      {
        ...(useNormalized ? { é: 2.25 } : {}),
        "😀": 2.75,
        B: 1.5,
      },
    );
    await page.evaluate((useNormalized) => {
      window.context.profile = {
        ...window.context.profile,
        font: {
          ...window.context.profile.font,
          family: "monospace",
          boldOffset: 2,
          fallbackAdvance: useNormalized ? 1.5 : 2.25,
        },
      };
      window.preview.update({ document: window.doc, context: window.context });
    }, useNormalized);
    await page.clock.runFor(80);
    await expect(glyph).toHaveText("😀");
  });

test("only original U+0020 bypasses obfuscation and spaces remain candidates", async ({
  page,
}) => {
  await setup(page);
  const glyphs = await preview(page, "<obfuscated>A \u00a0", {
    A: 4,
    " ": 4,
    "\u00a0": 4,
    B: 4,
  });
  await page.clock.runFor(80);
  await expect(glyphs).toHaveText(["B", " ", "B"]);
  await page.evaluate(() => {
    Math.random = () => 0.3;
  });
  await page.clock.runFor(80);
  await expect(glyphs).toHaveText([" ", " ", " "]);
});

test("reduced motion pauses and resumes an existing viewer without edits", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  const glyph = await preview(page);
  const source = await page.evaluate(() => JSON.stringify(window.doc));
  await page.evaluate(() => {
    window.motionChanges = 0;
    window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .addEventListener("change", () => window.motionChanges++);
  });
  await page.clock.runFor(160);
  await expect(glyph).toHaveText("A");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // Native media-query events are delivered outside the mocked clock (WebKit).
  await expect.poll(() => page.evaluate(() => window.motionChanges)).toBe(1);
  await page.clock.runFor(80);
  await expect(glyph).toHaveText("B");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => page.evaluate(() => window.motionChanges)).toBe(2);
  await page.evaluate(() => {
    Math.random = () => 0;
  });
  await page.clock.runFor(160);
  await expect(glyph).toHaveText("B");
  expect(await page.evaluate(() => JSON.stringify(window.doc))).toBe(source);
});

test("pause, replacement and disposal stay independent across viewers", async ({
  page,
}) => {
  await setup(page);
  const first = await preview(page);
  await page.evaluate(() =>
    window.second.update({ document: window.doc, context: window.context }),
  );
  const second = page.locator("#second .mcp-motd .mcp-glyph");
  await page.clock.runFor(80);
  await expect(first).toHaveText("B");
  await expect(second).toHaveText("B");
  await page.evaluate(() => {
    window.preview.update({
      document: window.doc,
      context: { ...window.context, animations: false },
    });
    Math.random = () => 0;
  });
  await page.clock.runFor(80);
  await expect(first).toHaveText("A");
  await expect(second).toHaveText("A");
  await page.evaluate(() => {
    Math.random = () => 0.99;
    window.retiredGlyph = document.querySelector(
      "#second .mcp-motd .mcp-glyph",
    );
    window.second.destroy();
  });
  await page.clock.runFor(80);
  await expect(first).toHaveText("A");
  expect(await page.evaluate(() => window.retiredGlyph.textContent)).toBe("A");
  await page.evaluate(() =>
    window.preview.update({ document: window.doc, context: window.context }),
  );
  await page.clock.runFor(80);
  await expect(first).toHaveText("B");
});

test("changing replacement ink preserves editor selection, source and undo", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    window.editor.execute({
      type: "replace-source",
      source: "<obfuscated><b><i>Ab iMW 42<newline>Wi</i></b>",
    });
  });
  const input = page.getByRole("textbox", {
    name: "MOTD inline editor",
    exact: true,
  });
  await input.focus();
  await input.evaluate((root) => {
    const text = root.ownerDocument
      .createTreeWalker(root, NodeFilter.SHOW_TEXT)
      .nextNode()!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 1);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
  });
  const before = await page.evaluate(() => ({
    source: JSON.stringify(window.doc),
    selected: document.getSelection()!.toString(),
    changes: window.changes.length,
  }));
  expect(before.selected).toBe("A");
  const positions = await page
    .locator("#preview .mcp-motd .mcp-glyph")
    .evaluateAll((nodes) =>
      nodes.map((node) =>
        (node as HTMLElement).style.cssText.match(/(?:left|top|width):[^;]+/g),
      ),
    );
  await page.clock.runFor(160);
  expect(
    await page.evaluate(() => ({
      source: JSON.stringify(window.doc),
      selected: document.getSelection()!.toString(),
      changes: window.changes.length,
    })),
  ).toEqual(before);
  expect(
    await page
      .locator("#preview .mcp-motd .mcp-glyph")
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          (node as HTMLElement).style.cssText.match(
            /(?:left|top|width):[^;]+/g,
          ),
        ),
      ),
  ).toEqual(positions);
  await page.evaluate(() => window.editor.execute({ type: "undo" }));
  expect(await input.textContent()).toContain("Grounds");
});

test("an unsupported width keeps its fallback rather than borrowing another class", async ({
  page,
}) => {
  await setup(page);
  const glyph = await preview(page, "<obfuscated>😀", { A: 2, B: 2 });
  const width = await glyph.evaluate(
    (node) => (node as HTMLElement).style.width,
  );
  await page.clock.runFor(160);
  await expect(glyph).toHaveText("😀");
  expect(
    await glyph.evaluate((node) => (node as HTMLElement).style.width),
  ).toBe(width);
  expect(
    await page.evaluate(() =>
      window.preview.getDiagnostics().some((d) => d.code === "missing-glyph"),
    ),
  ).toBe(true);
});

test("a parent-created viewer uses its iframe's animation realm and disposes it", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(async () => {
    const iframe = document.createElement("iframe");
    iframe.src = "/tests/browser/host.html";
    const loaded = new Promise((resolve) =>
      iframe.addEventListener("load", resolve, { once: true }),
    );
    document.body.append(iframe);
    await loaded;
    const child = iframe.contentWindow!;
    child.second.destroy();
    child.Math.random = () => 0.99;
    Math.random = () => 0;
    const doc = window.api.createDocument(
      window.api.parseText("<obfuscated>A", "minimessage").value!,
    );
    window.crossPreview = window.dom.createPreview(
      child.document.querySelector("#second")!,
      {
        document: doc,
        context: {
          ...window.context,
          profile: {
            ...window.context.profile,
            font: { ...window.context.profile.font, advances: { A: 6, B: 6 } },
          },
        },
      },
    );
  });
  const glyph = page
    .frameLocator("iframe")
    .locator("#second .mcp-motd .mcp-glyph");
  await page.clock.runFor(16);
  await expect(glyph).toHaveText("B");
  await page.evaluate(() => {
    const child = document.querySelector("iframe")!.contentWindow!;
    window.retiredFrameGlyph = child.document.querySelector(
      "#second .mcp-motd .mcp-glyph",
    );
    window.crossPreview.destroy();
    child.Math.random = () => 0;
  });
  await page.clock.runFor(80);
  expect(await page.evaluate(() => window.retiredFrameGlyph.textContent)).toBe(
    "B",
  );
});

async function changesOnFrames(page: Page, timestamps: number[]) {
  await setup(page);
  await page.evaluate(() => {
    window.pendingRafs = new Map();
    let id = 0;
    window.requestAnimationFrame = (callback) => {
      window.pendingRafs.set(++id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id) => window.pendingRafs.delete(id);
  });
  await preview(page);
  return page.evaluate((timestamps) => {
    let turn = 0,
      changed = 0;
    Math.random = () => (++turn % 2 ? 0.99 : 0);
    const glyph = document.querySelector("#preview .mcp-motd .mcp-glyph")!;
    let previous = glyph.textContent;
    for (const timestamp of timestamps) {
      const callbacks = [...window.pendingRafs.values()];
      window.pendingRafs.clear();
      for (const callback of callbacks) callback(timestamp);
      if (glyph.textContent !== previous) changed++;
      previous = glyph.textContent;
    }
    window.preview.destroy();
    return changed;
  }, timestamps);
}

for (const { hz, changes } of [
  { hz: 30, changes: 30 },
  { hz: 60, changes: 60 },
  { hz: 120, changes: 60 },
  { hz: 144, changes: 60 },
  { hz: 500, changes: 60 },
])
  test(`native menu frame budget at ${hz} Hz browser refresh`, async ({
    page,
  }) => {
    const timestamps = Array.from(
      { length: hz },
      (_, frame) => (frame * 1000) / hz,
    );
    expect(await changesOnFrames(page, timestamps)).toBe(changes);
  });

for (const precision of [0.1, 1, 2])
  for (const origin of [0, 193.3])
    test(`rounded ${precision}ms timestamps keep native cadence at phase ${origin}`, async ({
      page,
    }) => {
      const timestamps = Array.from(
        { length: 120 },
        (_, frame) =>
          Math.round((origin + (frame * 1000) / 60) / precision) * precision,
      );
      expect(await changesOnFrames(page, timestamps)).toBe(120);
    });

test("sustained rainbow motion reuses backing surfaces across glyphs and colors", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    window.rasterSurfaces = 0;
    const original = document.createElement.bind(document);
    document.createElement = ((tag, options) => {
      const element = original(tag, options);
      if (tag === "canvas") window.rasterSurfaces++;
      return element;
    }) as typeof document.createElement;
  });
  await page.evaluate(() => {
    window.doc = window.api.createDocument(
      window.api.parseText(
        `<rainbow><obfuscated>${"W".repeat(40)}<newline>${"W".repeat(40)}`,
        "minimessage",
      ).value!,
    );
    window.preview.update({ document: window.doc, context: window.context });
  });
  const glyphs = page.locator("#preview .mcp-motd .mcp-glyph");
  await expect(glyphs).toHaveCount(80);
  for (let frame = 0; frame < 12; frame++) {
    await page.evaluate((value) => {
      Math.random = () => value;
    }, frame / 12);
    await page.clock.runFor(17);
  }
  expect(await glyphs.first().textContent()).not.toBe("W");
  expect(await page.evaluate(() => window.rasterSurfaces)).toBeLessThanOrEqual(
    4,
  );
});
