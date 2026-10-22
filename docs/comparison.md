# Comparing clients

`createComparison` from `@groundsgg/motd/dom` renders several client previews
from one document. The library supplies no networking or persistence; every
context comes from the host. Contexts may use different profiles, client
protocols, GUI scales, backgrounds, placeholder values and base status data.

```ts
import { createComparison } from "@groundsgg/motd/dom";
import "@groundsgg/motd/styles.css";

const comparison = createComparison(host, {
  document,
  clients: [
    { id: "classic", label: "Classic client", context: classicContext },
    { id: "modern", label: "Modern client", context: modernContext },
  ],
});

// Editor changes supply a new shared document. Context never enters it.
comparison.update({ document: nextDocument, clients });
const notesByClient = comparison.getDiagnostics();
const differencesByClient = comparison.getDifferences();
comparison.destroy();
```

Client IDs must be nonempty and unique within the comparison. An invalid list
throws before changing the existing view. Reordering retains the preview handle
for each ID; removing an ID destroys its preview and animation/tooltip resources.
An empty list shows a translatable empty state. Repeated destruction and updates
after destruction are harmless.

Each panel displays its profile version, effective background, client protocol
and GUI scale. Diagnostics such as wrapping, hidden lines and unreachable player
hover are shown separately for each client. `getDiagnostics()` returns a map
keyed by client ID; returned maps and arrays can be changed without altering the
comparison's records.

The first client is the reference. `getDifferences()` reports which evaluated
server-status fields differ from it: `version`, `players` (including hover
samples), `description` or `favicon`. Panels label these differences. This is a
comparison of evaluated status data, not a promise that different font profiles
or backgrounds produce identical pixels. Layout differences remain visible in
the previews and diagnostics. Reordering clients changes the reference.

## React

The optional React entry point exposes the same options:

```tsx
import { ServerListComparison } from "@groundsgg/motd/react";

<ServerListComparison
  document={document}
  clients={[
    { id: "classic", context: classicContext },
    { id: "modern", context: modernContext },
  ]}
/>;
```

The adapter renders an empty host during SSR, updates on prop changes and
destroys every preview on unmount, including under React Strict Mode. `className`
and `style` apply to the outer host. Core and DOM consumers do not need React.

Wide native canvases scroll inside their panel instead of overflowing the page.
The grid becomes a single column on narrow screens. Each context's
`animations: false` and the existing reduced-motion behavior apply independently.

## Labels

The shared `labels` option also reaches each preview. Comparison-specific keys
are `comparisonProtocol`, `comparisonScale`, `comparisonBackground`,
`comparisonReference`, `comparisonDifferences`, `comparisonSame`,
`comparisonDiagnostics`, `comparisonEmpty`, and `comparisonField.version`,
`comparisonField.players`, `comparisonField.description`,
`comparisonField.favicon`. Client labels are supplied by the host; diagnostic
messages retain the existing diagnostic contract.
