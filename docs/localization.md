# Localization

Viewer, editor and comparison options accept a partial `labels` string map.
English is the default. Complete `englishLabels` and `germanLabels` catalogs,
`MessageKey`, `LabelOverrides`, `formatLabel`, `interpolateMessage` and
`formatDiagnostic` are exported from `@groundsgg/motd`. They work in Node without
DOM or React and need no translation service.

```ts
import { germanLabels, formatDiagnostic, parseText } from "@groundsgg/motd";
import { createEditor } from "@groundsgg/motd/dom";

const options = {
  document,
  context,
  onChange,
  labels: { ...germanLabels, bold: "Fett" },
};
const editor = createEditor(host, options);
editor.update({ ...options, labels: { ...germanLabels, bold: "Fettschrift" } });
const translated = editor
  .getDiagnostics()
  .map((d) => formatDiagnostic(d, germanLabels));
```

React accepts the same `labels` prop on `ServerListEditor`, `ServerListPreview`
and `ServerListComparison`. Both standalone examples include an interface
language selector. The host controls its own surrounding UI and HTML `lang`.
The library never changes a global language setting.

Changing labels updates open tools, accessible names, tooltips, status messages
and diagnostics in place. It preserves focused inputs, selections, uncommitted
source/crop drafts and undo history. Labels are literal text, never HTML.
Server names, MOTD content, placeholders, addresses and host error details are
not translated. Each instance has independent labels.

## Keys and named parameters

The exported English catalog is the complete key reference. Existing partial
overrides remain supported; omitted keys fall back to English. Merge the German
catalog before overriding a German label. `MessageKey` can type a custom
catalog, and `LabelOverrides` also permits host-defined diagnostic keys.

Parameterized labels use `{name}` tokens. For example:

```ts
import { formatLabel, germanLabels } from "@groundsgg/motd";

formatLabel("calculatedPreview", { online: 12, maximum: 100 }, germanLabels);
// "Berechnete Vorschau: 12/100"

const labels = {
  ...germanLabels,
  gradientColorNumber: "Farbe {index}: {label}",
};
```

Numbered gradient labels receive `index` (one-based) and the translated base
`label`. Calculated player counts receive `online` and `maximum`; `morePlayers`
receives `count`. Diagnostic parameters include the relevant `name`, `tag`,
`glyph` or limit. Consult the catalog template for each message's parameter
names. Existing base-label overrides still feed numbered labels. Legacy
`versionHint`, `hoverHint` and `draftInvalidated` overrides remain supported;
the complete catalogs use more specific state-dependent keys instead.

Substitution happens once. Inserted values are not interpreted as templates or
markup; unknown tokens remain unchanged. `formatLabel(key, parameters, labels,
fallback)` uses an own string property in `labels`, then the English catalog,
then the supplied fallback (default: the key). An empty string is a valid
override. It never reads inherited properties such as `constructor`.

## Diagnostics

Diagnostics retain their stable `code`, `severity`, `path` and English `message`.
Built-in diagnostics additionally carry `messageKey` and, where needed,
`parameters`. Persist or branch on `code`, not translated text. Use
`formatDiagnostic(diagnostic, labels)` for display. DOM tools do this
automatically; Preview and comparison `getDiagnostics()` retain the original structured diagnostics.

A host diagnostic without `messageKey` keeps its supplied message. For an
unknown key, a matching host label is used if present, otherwise the supplied
message remains the fallback. Existing adapters that only provide `message`
continue to work.
