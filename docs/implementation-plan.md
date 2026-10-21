---
title: "Minecraft Serverlisten Bibliothek Implementierungsplan"
description: "Eigenständiges NPM Paket mit Textkern, Inline Editor, React Anbindung, Demo und Referenztests umsetzen."
---

# Minecraft Server List Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Liefere ein eigenständig installierbares `@groundsgg/motd` mit realistischer Java-Serverlisten-Vorschau und direkt bearbeitbarem Servereintrag.

**Architecture:** Ein browserunabhängiger Text- und Statuskern bedient einen DOM-Editor. ProseMirror verwaltet Dokumentänderungen, Auswahl und Eingabekomposition im DOM-Einstiegspunkt; React ist eine optionale Anbindung derselben Oberfläche. Grounds-Code gehört ausschließlich in den [separaten Integrationsplan](2026-10-21-motd-grounds-integration.md).

**Tech Stack:** TypeScript, native ESM, npm, Vitest, Playwright, ProseMirror, React als optionale Peer-Abhängigkeit, Vite ausschließlich für Beispiele. Der Kern hat keine Laufzeitabhängigkeit von React, ProseMirror, Node-APIs oder einem Backend. Dev-Abhängigkeiten werden beim Aufbau mit stabilen Versionen im Lockfile fixiert.

**Spec:** [Freigegebene Spezifikation](../specs/2026-10-21-minecraft-server-list-design.md), Commit `6ad5821` im Docs-Repository.

## Global Constraints

- Die NPM-Bibliothek funktioniert ohne Grounds-Dienste, Anmeldung und verpflichtende Netzwerkzugriffe.
- Vorschau, visuelle Bearbeitung und Quelltextmodus verwenden dasselbe Dokumentmodell.
- Darstellung und Export verwenden dieselben Schriftmetriken und Layoutregeln.
- Funktionen, Werkzeugleisten, Beschriftungen und Gestaltung sind konfigurierbar.
- Fremde Formatinformationen bleiben beim Import erhalten, auch wenn der visuelle Editor sie nicht bearbeiten kann.
- Einstiegspunkte: `@groundsgg/motd`, `@groundsgg/motd/dom`, `@groundsgg/motd/react`; zusätzlicher expliziter Styles-Export `@groundsgg/motd/styles.css`.
- Die erste Abnahme erfolgt gegen Minecraft Java 1.21.1 mit Standardschrift und festgehaltenen GUI-Einstellungen.
- Icon-Ausgabe: 64 mal 64 Pixel PNG; Eingaben: PNG und JPEG.
- Kein ungefragter Serverimport, keine Telemetrie und keine impliziten Downloads. Browserassets werden ausschließlich als explizit konfigurierte oder lokal gebündelte Ressourcen geladen.
- Die Bibliothek erhält eine eigene Implementierung und eigene Assets.
- Dieser Plan erstellt ein lokal paketierbares Artefakt. Veröffentlichung bei npm und Deployment sind eigene abschließende Aktionen.

## Review Focus

1. Teilweise unterstützte, verschachtelte Quelltexte dürfen bei einer benachbarten visuellen Änderung keinen Inhalt verlieren: Task 3 und 8.
2. Kombinierende Zeichen, Emoji und laufende IME-Komposition dürfen Auswahl und Undo nicht beschädigen: Task 5 und 8.
3. Zwei eingebettete Editoren und React-Neumounts dürfen keine Events, Auswahl oder Animationsintervalle teilen: Task 7 und 10.
4. Verborgene Spielerdaten und erzwungener Versionshinweis dürfen keinen tatsächlich unerreichbaren Hover vortäuschen: Task 6 und 9.
5. Fehlerhafte Bilder, nicht endende Importe und übertiefe Texte müssen abbrechbar sein und den letzten gültigen Entwurf erhalten: Task 3 und 9.

## Arbeitsort und Dateistruktur

Neues eigenständiges Repository: `/home/lukas/grounds/library-motd`. Vor Erstellung prüfen, ob es inzwischen existiert; vorhandene Arbeit weiterverwenden, ohne zu überschreiben. Bei Ausführung die geltenden Repository-Anweisungen lesen und die freigegebene Spezifikation in `docs/design.md` mitführen. Kein neues GitHub-Repository oder Release für den lokalen Aufbau erforderlich.

Alle nachfolgenden Pfade sind relativ zu diesem neuen Repository. Dateien werden beim jeweiligen fachlichen Task angelegt, nicht vorab als leere Platzhalter.

| Pfad                                                                                   | Verantwortung                                                                             |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/index.ts`, `src/core/model.ts`, `src/core/document.ts`, `src/core/diagnostics.ts` | Öffentliche Typen, Validierung, Dokumentlebenszyklus                                      |
| `src/core/text/{parse,minimessage,legacy,properties,json,serialize}.ts`                | Formate und Quelltexttreue                                                                |
| `src/core/text/{colors,placeholders,simplify}.ts`                                      | Farbeffekte, Resolver und optionale Importhilfen                                          |
| `src/core/layout/{layout,profiles}.ts`, `src/profiles/java-1.21.1.ts`                  | Glyphenmetriken und Clientgeometrie                                                       |
| `src/core/status/{evaluate,template,import}.ts`                                        | Ausgewertete Statusantwort, übertragbare Statusvorlage und Import gelieferter Statusdaten |
| `src/dom/{index,preview,tooltips,animation}.ts`, `src/dom/styles.css`                  | Darstellung und unabhängiger Lebenszyklus                                                 |
| `src/dom/editor/{index,schema,mapping,commands,history,toolbar,source}.ts`             | Inline-Eingabe, Auswahl, gemeinsame Historie und Quelltextmodus                           |
| `src/dom/{icon,import,properties}.ts`                                                  | Bildverarbeitung, Importadapter und Status-Eigenschaften                                  |
| `src/react/index.tsx`                                                                  | Kontrollierte React-Anbindung                                                             |
| `assets/`, `THIRD_PARTY_NOTICES.md`, `tests/fixtures/`                                 | Gebündelte Assets und nachvollziehbare Referenzen                                         |
| `tests/unit/`, `tests/browser/`, `tests/package/`, `tools/`                            | Semantik-, Browser- und Paketprüfungen                                                    |
| `examples/dom/`, `examples/react/`, `docs/`, `README.md`                               | Eigenständige Beispiele und öffentliche Nutzung                                           |

## Gemeinsame Verträge

Task 1 definiert alle folgenden Typen in `src/core/model.ts`. Tests und Folgetasks verwenden diese Namen.

- `Outcome<T> = { value: T | null; diagnostics: readonly Diagnostic[] }`; Diagnosen haben `code`, `severity`, `path`, `message` und einen optionalen Quelltextbereich. Fehler erzeugen `value: null`; Warnungen können einen Wert begleiten.
- `TextFormat = 'minimessage' | 'legacy-ampersand' | 'legacy-section' | 'properties' | 'json'`.
- `TextDocument` enthält `revision`, einen rekursiven `nodes`-Baum und optional `source: { format, value, revision }`. Nodes haben eine stabile `id` und sind `text`, `group`, `newline`, `placeholder` oder `opaque`.
- `text` enthält `value`; `group` enthält `children` und vererbte Textstile einschließlich optionalem `gradient` oder `rainbow`; `placeholder` enthält `name`; `opaque` enthält `raw`, `format` und einen optionalen darstellbaren Fallback. Stile haben explizite boolesche Dekorationen und optionale Farbe. Verläufe enthalten geordnete `{ color, position }`-Stops mit Positionen zwischen 0 und 1; Rainbow enthält Phase und Richtung.
- `ServerListDocument` enthält `schemaVersion: 1`, `motd: { text: TextDocument, alignments: readonly Alignment[] }`, `version: VersionRule`, `icon: IconValue | null`, `players: PlayerRules`, `hover: HoverRule`, `extensions: Readonly<Record<string, JsonValue>>`. `Alignment = 'left' | 'center' | 'right'`; `JsonValue` ist rekursiv auf JSON-Werte beschränkt.
- `VersionRule` ist `automatic`, `when-incompatible` oder `always`; eigene Hinweise enthalten einen `TextDocument`. `IconValue` enthält das normalisierte `pngBase64`. `HoverRule` ist `inherit`, `custom` mit einem `TextDocument` oder `disabled`.
- `CountRule` ist `inherit`, `fixed(value)`, `offset(value)`, `percent(value)` oder `headroom(value)`. `PlayerRules` enthält `hidden`, `online` und `maximum`. `headroom` ist nur beim Maximum zulässig und bezieht sich auf die bereits ausgewertete Onlinezahl.
- `RuntimeContext` enthält `base: JavaStatus`, `clientProtocol`, optional `compatible`, sowie `values: Readonly<Record<string, string>>`. Ohne `compatible` entscheidet Protokollgleichheit; Anwendungen mit Protokollübersetzung übergeben ihre eigene Entscheidung.
- `PreviewContext` ergänzt RuntimeContext um `profile: ClientProfile`, `viewportWidth`, `guiScale`, `serverName`, `pingMs` und `animations`. Es enthält keine gespeicherten Servereinstellungen.
- `JavaStatus` enthält `version: { protocol: number, name: string }`, optional `players: { online, max, sample: readonly { name, id }[] }`, `description: JsonValue` und optional `favicon: string`.
- `ParseOptions` enthält die optionalen Felder `maxTextLength` und `maxDepth`. `SerializeOptions` enthält `lossy: 'reject' | 'reduce'` sowie optionale Layoutdaten. Ein `TextTarget` benennt Format, unterstützte Farben/Dekorationen, Hex-Darstellung und bei Properties die Zeichenkodierung.
- `StatusTemplate` enthält `schemaVersion: 1` und dieselben fachlichen Felder wie `ServerListDocument`, ohne `extensions`, Quelltextzuordnungen oder Editorzustände. Nodes behalten Formatsemantik, Platzhalter und geschützte Konstrukte. Die Vorlage erlaubt die spätere JVM-Auswertung ohne JavaScript im Proxy.
- `EditorOptions` enthält erforderliche `document: ServerListDocument`, `context: PreviewContext`, `onChange: (document: ServerListDocument, change: EditorChange) => void` und optionale `features`, `labels`, `readOnly`, `disabled`, `imports`. `features` ist `Partial<Record<'motd' | 'icon' | 'version' | 'players' | 'hover' | 'import' | 'export', boolean>>`; fehlende Einträge sind aktiviert. `labels` ist `Readonly<Record<string, string>>`; fehlende Labels verwenden englische Standardtexte. `imports` enthält einen `ImportAdapter` und optional `timeoutMs`. `EditorChange` enthält `origin: 'visual' | 'source' | 'import' | 'history'` und `changedFields: readonly ('motd' | 'version' | 'icon' | 'players' | 'hover')[]`.

### Task 1: Installierbarer Kern mit gültigem Dokumentmodell

**Files:** Create `package.json`, `package-lock.json`, `tsconfig.json`, `vitest.config.ts`, `src/index.ts`, `src/core/{model,document,diagnostics}.ts`, `docs/design.md`; Test `tests/unit/document.test.ts`, `tests/package/core-import.test.mjs`.

**Interfaces:** Produces `createDocument(motd?: TextDocument): ServerListDocument`, `validateDocument(input: unknown): Outcome<ServerListDocument>`, `readDocument(json: string): Outcome<ServerListDocument>`, `writeDocument(document: ServerListDocument): string` und die gemeinsamen Typen.

- [ ] Schreibe Tests `document_defaults_preserve_live_values`, `unknown_schema_is_rejected`, `history_and_preview_are_not_persisted`, `invalid_rules_have_field_paths`: Defaults sind automatische Version, übernommene Zahlen und Hover; JSON-Rundlauf erhält Dokumentdaten, ohne Auswahl/Undo/Kontext zu speichern.

  ```ts
  expect(createDocument().version.mode).toBe("automatic");
  expect(readDocument(writeDocument(createDocument())).value).toEqual(
    createDocument(),
  );
  expect(validateDocument({ schemaVersion: 99 }).value).toBeNull();
  ```

- [ ] Richte nur den zum Task nötigen TypeScript-/Vitest-Aufbau ein und führe `npm test -- tests/unit/document.test.ts` aus; erwarte fehlende öffentliche Funktionen.
- [ ] Implementiere die Typen und Funktionen. ESM-Ausgabe nach `dist/`, generierte Typdeklarationen, präzise Exports und Node-Import ohne `window`, `document`, React oder ProseMirror. Lege Limits mit konfigurierbaren Defaults von 65.536 Quelltextzeichen und 128 Verschachtelungsebenen fest.
- [ ] Führe `npm run build && npm test -- tests/unit/document.test.ts && node --test tests/package/core-import.test.mjs` aus; erwarte gültigen Rundlauf und erfolgreichen Import bei gesperrtem `fetch`.
- [ ] Committe Modell und Aufbau mit `feat: add standalone document core`.

### Task 2: Nachvollziehbares Java Referenzprofil und lokale Assets

**Files:** Create `src/core/layout/profiles.ts`, `src/profiles/java-1.21.1.ts`, `assets/java-1.21.1/`, `THIRD_PARTY_NOTICES.md`, `tools/reference/README.md`, `tests/fixtures/client/java-1.21.1/{manifest.json,expected-layout.json}` und Referenzaufnahmen; Test `tests/unit/profile.test.ts`.

**Interfaces:** Produces `ClientProfile` mit `id`, Clientversion, `font: FontProfile`, `geometry` und Tooltipregeln; `FontProfile` definiert Glyphenzuordnung, Fortschritt, Schatten und Fallback. Export `java1211Profile`.

- [ ] Schreibe `reference_profile_matches_recorded_advances` und `all_assets_resolve_locally`: Prüfe die gemessenen Referenzwerte für `Mi! äé`, Leerzeichen und Bold sowie Assetpfade ohne fremde Origins. Erfasse dafür zuerst die Referenzdaten aus Java 1.21.1 mit Standardschrift, GUI-Skalierung und aufgezeichneten Fenstermaßen.

  ```ts
  expect(java1211Profile.id).toBe("java-1.21.1");
  expect(actualAdvances).toEqual(reference.advances);
  expect(assetOrigins.every((origin) => origin === localOrigin)).toBe(true);
  ```

- [ ] Führe `npm test -- tests/unit/profile.test.ts` aus; erwarte ein fehlendes Profil oder fehlende Assets.
- [ ] Implementiere das Profil aus den Referenzdaten. Dokumentiere Clientbuild, Aufnahmeablauf, Hashes und Herkunft/Weitergabe jedes gebündelten Assets. Verwende keine Dateien von MOTD Studio. Ein ähnlich aussehender Ersatzfont darf nicht als geprüfte Standardschrift ausgegeben werden.
- [ ] Führe Profiltests aus und prüfe die Aufnahmen visuell; erwarte identische Referenzfortschritte und lokal auflösbare Assets. Fehlende Clientreferenzen oder unklare Assetherkunft bleiben ein ausdrücklich offenes Abnahmekriterium, kein ersetzter Screenshot aus dem eigenen Renderer.
- [ ] Committe Profil, Assets und Referenzdaten mit `feat: add verified Java client profile`.

### Task 3: MiniMessage Import ohne Quelltextverlust

**Files:** Create `src/core/text/{parse,minimessage}.ts`, `tests/fixtures/text/minimessage.json`; Test `tests/unit/minimessage.test.ts`. Modify `src/index.ts`.

**Interfaces:** Produces `parseText(input: string, format: TextFormat, options?: ParseOptions): Outcome<TextDocument>`; implementiert zunächst `minimessage`, andere Formate folgen in Task 4.

- [ ] Schreibe `nested_styles_keep_inheritance`, `escaped_open_tag_is_literal`, `unclosed_tags_match_lenient_mode`, `opaque_subtree_keeps_raw_source`, `depth_limit_keeps_previous_document`: Vergleiche Nodes und Quelltextbereiche für `<red>A<b>B</b>C`, `\\<red>`, einen geschützten Hover-Unterbaum und Tiefe 129 bei Limit 128. Fehler ergeben `value: null` mit Diagnose, keine Teilmutation eines bestehenden Dokuments.

  ```ts
  const raw = "<red>A<b>B</b>C";
  expect(parseText(raw, "minimessage").value?.source?.value).toBe(raw);
  expect(
    parseText("<b>".repeat(129), "minimessage", { maxDepth: 128 }).value,
  ).toBeNull();
  ```

- [ ] Führe `npm test -- tests/unit/minimessage.test.ts` aus; erwarte Parserfehler bzw. fehlende Nodes.
- [ ] Implementiere einen Tokenizer mit Stack statt eines Regex-Tagstrippers. Unterstütze Farb-Aliase, explizite falsche Dekorationen, Reset, Newline, Escapes, Gradients und Rainbow mit Phase/Richtung. Bewahre unbekannte Teilbäume und deren Kontext; behandle nie rohe Tags als HTML.
- [ ] Führe Parsertests aus; erwarte stabile IDs, passende Diagnosen und ursprünglichen Quelltext am unveränderten Dokument.
- [ ] Committe mit `feat: parse MiniMessage without losing source`.

### Task 4: Weitere Formate und semantisch geprüfter Export

**Files:** Create `src/core/text/{legacy,properties,json,serialize}.ts`, `tools/adventure-fixtures/`, `tests/fixtures/text/adventure.json`; Test `tests/unit/formats.test.ts`, `tests/unit/serialize.test.ts`. Modify `src/core/text/parse.ts`, `src/index.ts`.

**Interfaces:** Consumes Task 3; produces `serializeText(text: TextDocument, target: TextTarget, options?: SerializeOptions): Outcome<string>` und vollständigen Formatdispatch in `parseText`. Die Properties-Profile verwenden standardmäßig Vanilla-16-Farben; Bukkit-Hex ist ein anderes explizites Profil.

- [ ] Schreibe `unchanged_source_is_byte_exact`, `legacy_space_resets_bold`, `properties_escapes_backslash_and_leading_space`, `json_false_overrides_parent`, `unsupported_target_rejects_loss`: Prüfe insbesondere Bold-`A`, unformatiertes Leerzeichen, normales `B` sowie `path\\name`, führende Leerzeichen und `\\n`. Nicht unterstütztes RGB liefert ohne explizite Reduktion keinen Exportwert.

  ```ts
  for (const fixture of adventureFixtures) {
    const parsed = parseText(fixture.input, fixture.format);
    expect(serializeText(parsed.value!, fixture.target).value).toBe(
      fixture.expectedExport,
    );
  }
  expect(exportRgbToVanilla16WithoutReduction.value).toBeNull();
  ```

- [ ] Führe `npm test -- tests/unit/formats.test.ts tests/unit/serialize.test.ts` aus; erwarte fehlende Serializer bzw. nicht erfüllte Formatwechsel.
- [ ] Implementiere Formatadapter und Serializer mit Quelltextdurchreichung bei unveränderter Revision. Erzeuge semantische Referenzfixtures mit Adventure MiniMessage/Legacy/Gson in einem isolierten JVM-Testwerkzeug; Version und Eingaben stehen im Fixturemanifest. Vergleiche normalisierte Text-/Stileigenschaften, nicht JSON-Whitespace.
- [ ] Führe Format- und Serializerprüfungen aus; erwarte semantische Übereinstimmung inklusive Escapes, Resets, geerbten Stilen, Phase/Richtung und geschützten Bereichen.
- [ ] Committe mit `feat: add loss-aware Minecraft text exports`.

### Task 5: Farben Platzhalter und profilbasiertes Textlayout

**Files:** Create `src/core/text/{colors,placeholders,simplify}.ts`, `src/core/layout/layout.ts`; Test `tests/unit/{effects,placeholders,layout}.test.ts`. Modify `src/index.ts`.

**Interfaces:** Produces `resolveText(text: TextDocument, values: Readonly<Record<string, string>>): Outcome<TextDocument>`, `layoutText(text: TextDocument, options: LayoutOptions): LayoutResult`, `suggestSimplification(text: TextDocument, options: SimplifyOptions): SimplificationProposal`. `LayoutOptions` enthält Profil, Breite, Zeilenlimit und Ausrichtungen; `LayoutResult` enthält Glyphen mit Dokumentpositionen, Zeilen, Padding und Diagnosen. Vorschläge enthalten Original, Kandidat und maximale Farbabweichung; eine Übernahme ist ausdrücklich.

- [ ] Schreibe `uneven_stops_keep_all_eight_colors`, `unknown_placeholder_stays_visible`, `placeholder_cannot_inject_tags`, `grapheme_positions_survive_layout`, `alignment_uses_actual_width`: Prüfe Stops bei 0, 5/7 und 1, die acht Farben aus der Importregression, `{{players}} = '<red>42'`, `e` plus kombinierenden Akzent und Emoji. Schätze fehlende Glyphen nicht still als sechs Pixel.

  ```ts
  expect(layout.glyphs.map((glyph) => glyph.color)).toEqual(
    originalEightColors,
  );
  expect(renderedPlaceholderText).toBe("<red>42");
  expect(simplificationSourceAfterSuggestion).toEqual(
    simplificationSourceBeforeSuggestion,
  );
  ```

- [ ] Führe `npm test -- tests/unit/effects.test.ts tests/unit/placeholders.test.ts tests/unit/layout.test.ts` aus; erwarte fehlende Effekte/Layoutwerte.
- [ ] Implementiere Effekte mit separaten Stopppositionen, textuelle Platzhalterersetzung und Glyphenlayout aus Task 2. Padding misst tatsächliche ausgegebene Leerzeichen einschließlich Stilwechseln. Mehr als zwei Zeilen bleiben erhalten und werden als unsichtbarer Überschuss diagnostiziert. Importhilfen verändern ohne Übernahme keine Nodes.
- [ ] Führe die Tests aus; erwarte gemeinsame Metriken für Vorschau/Export, erhaltene Einzelfarben und stabile Dokumentpositionen.
- [ ] Committe mit `feat: share text effects and client layout`.

### Task 6: Auswertung von Version Spielerregeln und Statusvorlage

**Files:** Create `src/core/status/{evaluate,template}.ts`; Test `tests/unit/status.test.ts`, `tests/unit/template.test.ts`, `tests/fixtures/status/contract.json`. Modify `src/index.ts`.

**Interfaces:** Produces `evaluateStatus(document: ServerListDocument, context: RuntimeContext): Outcome<JavaStatus>` und `compileStatusTemplate(document: ServerListDocument): Outcome<StatusTemplate>`; Signaturen und Fixtureformat werden vom Integrationsplan übernommen.

- [ ] Schreibe `automatic_keeps_base_version`, `conditional_uses_host_compatibility`, `always_changes_visible_version`, `counts_and_placeholders_agree`, `hidden_players_remove_samples`, `template_excludes_source_and_history`: Prüfe 42/500, Maximum-Headroom 10 ergibt 42/52, den eigenen Hinweis bei beiden Kompatibilitätszuständen und `players`-Abwesenheit bei verborgener Anzeige.

  ```ts
  expect(headroomResult.value?.players).toMatchObject({ online: 42, max: 52 });
  expect(hiddenResult.value?.players).toBeUndefined();
  expect(alwaysResult.value?.version.protocol).not.toBe(context.clientProtocol);
  ```

- [ ] Führe `npm test -- tests/unit/status.test.ts tests/unit/template.test.ts` aus; erwarte fehlende Statusauswertung.
- [ ] Implementiere Auswertung und wire-fähige Vorlage. Reihenfolge: echte Onlinebasis, Online-Regel, Maximum-Regel, reservierte `players`/`max`-Platzhalter, Texte, Version/Icon/Hover. Prozentwerte runden auf, Zahlen werden auf nichtnegative 32-Bit-Werte begrenzt und diagnostiziert; Zyklen/ungültige Headroom-Regeln sind Fehler. `always` meldet einen vom Client abweichenden Protokollwert; Versions-/Sample-Strings benutzen das tatsächliche Vanilla-Zielformat.
- [ ] Ergänze `missing_base_players_are_not_invented`: Fehlen Spielerdaten in der Basis und werden sie vollständig übernommen, bleibt `players` abwesend. Braucht eine Berechnung eine fehlende Basiszahl, liefert sie `missing-players`; feste Online- und Maximalwerte können dagegen vollständige neue Daten erzeugen. Eigene Hover-Sample-Einträge erhalten deterministisch die Null-UUID, keine zufälligen Spieleridentitäten.
- [ ] Führe Tests aus; erwarte getrennte Felder, dokumentierte Hoverkonflikte und JSON-serialisierbare Vorlagen ohne Vorschaukontext. Jede Fixture enthält Dokument, Basisstatus, Laufzeitwerte, erwartete Antwort und Diagnosen.
- [ ] Committe mit `feat: evaluate complete server list status`.

### Task 7: Einbettbare Serverlisten Vorschau mit echten Hoverbereichen

**Files:** Create `src/dom/{index,preview,tooltips,animation}.ts`, `src/dom/styles.css`, `tests/browser/preview.spec.ts`, `tests/browser/host.html`, `playwright.config.ts`; Modify `package.json` und Paketexports.

**Interfaces:** Produces `createPreview(host: HTMLElement, options: PreviewOptions): PreviewHandle`; `PreviewOptions = { document, context, labels? }`; Handle bietet `update(options: PreviewOptions): void`, `destroy(): void`. Tooltip und Animation bleiben instanzlokal.

- [ ] Schreibe Playwright-Prüfungen für Referenzlayout, zwei unabhängige Instanzen, Tastatur-Hover, verborgenes Spielerfeld, inkompatiblen Status, `prefers-reduced-motion` und zerstörte Instanzen. Vergleiche mit den extern erzeugten Aufnahmen aus Task 2, nicht mit erstmals selbst erzeugten Snapshots.

  ```ts
  await expect(page.getByTestId("server-row-a")).toHaveScreenshot(
    "client-reference.png",
  );
  await expect(page.getByTestId("player-tooltip")).toBeVisible();
  expect(activeAnimationCountAfterDestroy).toBe(0);
  ```

- [ ] Führe `npm run test:browser -- tests/browser/preview.spec.ts` aus; erwarte fehlende Vorschauoberfläche.
- [ ] Implementiere DOM und CSS auf Basis von Task 5/6. Verwende Textknoten, explizite Assetpfade und deklarierte Glyphenstile. Spieleffekte ändern nur die Präsentation. Überläufe, zusätzliche Tooltipzeilen und erreichbare Hoverflächen folgen dem Profil. Biete einen zugänglichen Textwert und Fokusziele.
- [ ] Führe Browserprüfungen aus; erwarte übereinstimmende Referenzen, keinen laufenden Timer nach `destroy()` und keinen Einfluss zwischen Instanzen.
- [ ] Committe mit `feat: render embeddable Minecraft server list`.

### Task 8: Inline Editor mit stabiler Auswahl und gemeinsamer Historie

**Files:** Create `src/dom/editor/{index,schema,mapping,commands,history,toolbar,source}.ts`; Test `tests/unit/editor-mapping.test.ts`, `tests/browser/editor.spec.ts`. Modify `src/dom/index.ts`, `src/dom/styles.css`.

**Interfaces:** Produces `createEditor(host: HTMLElement, options: EditorOptions): EditorHandle`; Handle bietet `update(options: EditorOptions): void`, `getDocument(): ServerListDocument`, `execute(command: EditorCommand): void`, `focus(field: EditableField): void`, `destroy(): void`. `EditableField = 'motd' | 'version' | 'hover'`; Commands: `format`, `gradient`, `align`, `set-field`, `replace-source`, `undo`, `redo`. Alle Befehle führen dieselbe Dokumenttransaktion aus.

- [ ] Schreibe Tests für Auswahl über Stilgrenzen, Formatieren nach Toolbarfokus, Verschieben eines Verlaufstops, benachbarte Änderung zu einem geschützten Quelltext-Unterbaum, Undo/Redo zwischen Inline- und Quelltextmodus, Paste und laufende IME-Komposition. Assertiere Dokumentinhalt, Auswahl und Änderungsereignisse; ein dritter visueller Zeilenumbruch wird verhindert, importierter Überschuss bleibt erhalten.

  ```ts
  expect(selectionAfterToolbar).toEqual(selectionBeforeToolbar);
  expect(documentAfterUndo).toEqual(documentBeforeChange);
  expect(opaqueRawAfterNeighbourEdit).toBe(opaqueRawBeforeNeighbourEdit);
  expect(committedCompositionText).toBe("日本語");
  ```

- [ ] Führe `npm test -- tests/unit/editor-mapping.test.ts` und `npm run test:browser -- tests/browser/editor.spec.ts` aus; erwarte fehlenden Editor bzw. fehlende Transaktionen.
- [ ] Implementiere die ProseMirror-Schema-/Positionsabbildung, atomare geschützte Nodes und inkrementelle Änderungen. Der ServerListDocument-Verlauf ist die zentrale Undo-Historie für alle Felder; keine konkurrierende zweite ProseMirror-Historie. Quelltextfehler behalten den letzten gültigen visuellen Entwurf und den fehlerhaften Text separat. Komposition wird nicht durch vollständiges Neurendern unterbrochen.
- [ ] Führe die Tests einschließlich Chromium und Firefox aus; erwarte stabile Auswahl und genau ein Änderungsereignis je übernommenem Vorgang. Prüfe IME zusätzlich mit einer echten Eingabemethode; synthetische CompositionEvents allein gelten nicht als vollständiger Nachweis.
- [ ] Committe mit `feat: edit server text inline with shared history`.

### Task 9: Icon Status Eigenschaften und abbrechbarer Import

**Files:** Create `src/dom/{icon,import,properties}.ts`, `src/core/status/import.ts`; Test `tests/unit/status-import.test.ts`, `tests/browser/properties.spec.ts`, `tests/browser/icon.spec.ts`, `tests/browser/import.spec.ts`, `tests/fixtures/images/`. Modify `src/dom/editor/{index,commands}.ts`, `src/index.ts`.

**Interfaces:** Produces im DOM-Einstiegspunkt `normalizeIcon(input: Blob, options?: IconOptions): Promise<Outcome<IconValue>>` und `ImportAdapter = (address: string, signal: AbortSignal) => Promise<JavaStatus>`; im Kern `importStatus(status: JavaStatus): Outcome<ServerListDocument>`. `IconOptions` enthält Pixelzuschnitt, maximale Bytes und dekodierte Pixel; Defaults: 10 MiB und 16 Millionen Pixel. Importstatus wird in Core-Code auf Form/Größe geprüft; Transport bleibt injiziert.

- [ ] Schreibe Prüfungen für JPEG/PNG-Zuschnitt auf exakt 64 mal 64 Pixel, beschädigte und zu große Bilder, Icon-Undo, alle Statusmodi, Spieler-Hover und Importabbruch. Assertiere, dass eine ältere Importantwort eine neuere Bearbeitung nicht überschreibt und fehlgeschlagener Import den gültigen Entwurf erhält.

  ```ts
  expect(decodedOutput).toMatchObject({ width: 64, height: 64, format: "png" });
  expect(documentAfterRejectedImage).toEqual(documentBeforeImage);
  expect(documentAfterStaleImport).toEqual(documentAfterNewerEdit);
  ```

- [ ] Führe `npm run test:browser -- tests/browser/properties.spec.ts tests/browser/icon.spec.ts tests/browser/import.spec.ts` aus; erwarte fehlende Bearbeitungsaktionen.
- [ ] Implementiere lokale Bildverarbeitung, Eigenschaften, Platzhalter-Vorschauwerte und explizite Importauslösung. Ein Import merkt sich Anfragegeneration und Dokumentrevision; nur bei unveränderten beiden Werten darf die Antwort übernehmen. Neue Anfragen, Abbruch, `destroy()` oder Timeout (Standard 10.000 ms, über `imports.timeoutMs` konfigurierbar) signalisieren dem Adapter Abbruch; Antworten nach Abbruch werden ignoriert. Trenne Preview-Werte von Dokumentbefehlen. Wende Funktionsschalter, Labels und Schreibschutz auf Inline-Eingabe, Befehle und Eigenschaften gleichermaßen an; externe `update`-Werte bleiben zulässig.
- [ ] Führe Browserprüfungen aus; erwarte gültige PNGs, atomare Undo-Vorgänge, keine Startanfrage und sichtbare Erklärung für nicht verfügbare Hoverkombinationen.
- [ ] Committe mit `feat: edit icons and server status properties`.

### Task 10: Optionale React Anbindung und eigenständige Beispiele

**Files:** Create `src/react/index.tsx`, `examples/{dom,react}/`, `tests/browser/react.spec.ts`, `tests/package/react-ssr.test.mjs`; Modify Paketexports und optionale React-Peer-Abhängigkeit.

**Interfaces:** Produces `ServerListPreview(props: PreviewOptions): ReactElement` und `ServerListEditor(props: EditorOptions): ReactElement`. Beide besitzen einen instanzlokalen Host; der Editorwert bleibt kontrolliert und eine bestätigte eigene Änderung setzt die Historie nicht zurück.

- [ ] Schreibe Tests für kontrollierte Updates, Strict-Mode-Neumount, zwei Instanzen und SSR-Import ohne DOM. DOM-Beispiel und React-Beispiel laden denselben lokalen Beispieldatensatz und zeigen Vorschau, Inline-Editor und Quelltextmodus.

  ```ts
  expect(onChangeCallsForOneEdit).toHaveLength(1);
  expect(activeInstancesAfterUnmount).toBe(0);
  expect(coreConsumerInstalledReact).toBe(false);
  ```

- [ ] Führe `npm run test:browser -- tests/browser/react.spec.ts` und `node --test tests/package/react-ssr.test.mjs` aus; erwarte fehlende Exports.
- [ ] Implementiere Wrapper und Beispiele. Events/Funktionen gehören nicht in persistierte Dokumente. Beim Unmount werden Listener, Observers und Animationen entfernt. Core-Verbraucher müssen React nicht installieren.
- [ ] Führe Tests und beide Beispiel-Builds aus; erwarte SSR-Import ohne Browserzugriff und keine Änderungsschleife bei einem zurückgereichten Dokumentwert.
- [ ] Committe mit `feat: add React adapter and standalone examples`.

### Task 11: Gepacktes Artefakt Dokumentation und Abnahme

**Files:** Create `tools/verify-package.mjs`, `.github/workflows/ci.yml`, `tests/package/consumers/`, `README.md`, `docs/{api,formats,profiles,embedding,limitations}.md`; Modify `package.json`, Demo und Beispiele.

**Interfaces:** Produces die lokal installierbare Tar-Datei aus `npm pack`; dokumentiert werden alle öffentlichen Typen, Befehle, Funktionsschalter, Limits, Formatfähigkeiten, CSS-Variablen, Labels und Lebenszyklusmethoden.

- [ ] Schreibe Paketprüfungen, die `npm pack` installieren: Node-Core ohne React/DOM, DOM-Beispiel ohne React sowie React-SSR und Browserbeispiel. Prüfe, dass keine internen Repositorypfade gebraucht werden und jeder Styles-/Asset-Export vorhanden ist.

  ```ts
  expect(consumerExitCodes).toEqual([0, 0, 0]);
  expect(missingPackageAssets).toEqual([]);
  expect(thirdPartyRequestsDuringEditing).toEqual([]);
  ```

- [ ] Führe `node tools/verify-package.mjs` aus; erwarte fehlende Paketbestandteile oder noch fehlschlagende Verbrauchertests.
- [ ] Ergänze Build-/Paketregeln, CI und vollständige Nutzungsbeispiele gegen das gepackte Artefakt. Dokumentiere geprüfte Clients und konkrete Einschränkungen, die Provenienz der Referenzen sowie ProseMirror als optionale UI-Laufzeitbasis. Die Demo erlaubt beide Kompatibilitätszustände, Textmodi, Icon-Zuschnitt und Hover ohne Backend.
- [ ] Führe `npm run typecheck && npm test && npm run build && npm run test:browser && node tools/verify-package.mjs` aus. Prüfe die Demo manuell und sperre Drittanbieterzugriffe während einer vollständigen Bearbeitungssitzung. Alle Pflichtprüfungen müssen grün sein; fehlende echte Client-/IME-Referenzen werden ausdrücklich als nicht erfüllte Abnahme gemeldet.
- [ ] Committe mit `test: verify standalone package and document public API`. Halte den finalen Paketnamen, die lokale Artefaktdatei und die grüne Version für den Integrationsplan fest. Kein automatischer npm-Publish.

## Übergang zur Integration

Der eigenständige Bibliotheksstand wird zuerst vollständig geprüft. Danach verwendet der Integrationsplan das gepackte Artefakt und `tests/fixtures/status/contract.json`. Änderungen am öffentlichen Statusvertrag benötigen passende Referenzfixtures und eine erneute Paketprüfung.

## Technische Referenzen

- [ProseMirror State](https://raw.githubusercontent.com/ProseMirror/prosemirror-state/master/README.md) und [ProseMirror View](https://raw.githubusercontent.com/ProseMirror/prosemirror-view/master/README.md) beschreiben Schema, Auswahl und DOM-Ereignisverarbeitung. Die Projekte verweisen auf ihre aktuellen Repositories unter `code.haverbeke.berlin`.
- Minecraft- und Adventure-Referenzen stehen in der freigegebenen Spezifikation. Clientreferenzen und Assets werden im neuen Repository mitgeführt; temporäre Forschungsdateien sind keine Build-Abhängigkeit.
