# Embedding

Import `@groundsgg/motd/styles.css` once. Package CSS references included fonts; editing makes no external requests. Use DOM handles for Vue/Svelte/custom elements or the optional React entry point. One host per instance; dispose on unmount.

Viewer and editor are separate: use `createPreview` / `ServerListPreview` for display-only content, and `createEditor` / `ServerListEditor` for editing. Set `context.presentation: "row"` for a compact entry, or `"server-list"` for the client menu. Omitting presentation retains the existing full-menu default.

```tsx
<ServerListPreview document={document} context={context} />
<ServerListEditor document={document} context={context} onChange={setDocument} toolbar="selection" />
```

`toolbar="fixed"` keeps formatting above the entry and is the default. `toolbar="selection"` attaches the same tools to selected text; changing the option at runtime preserves editing state. Text tools / `Alt+F10` provide access without a pointer selection. Keep tool preferences in application UI state rather than the saved server document. Both standalone examples include toolbar and presentation selectors.

Text tools open in the owning document, including when embedded in an iframe or scaled preview. The host must load the package stylesheet in that document. Popovers apply changes live and close on Escape; narrow viewports use a modal bottom sheet with the same controls. Read-only, disabled, and disabled-field states block mutating tools. Original source constructs remain protected; supported placeholder tokens can be formatted as a unit and retain their source name.

Click the player count or ping indicator for contextual status settings. **Server entry tools** also reaches player counts, version settings, and player hover when the native client hides them. Count rules apply live. Their calculated preview stays visible in player settings even when the native client hides the count or displays incompatible version text; preview values are never persisted. Custom hover opens a pinned, multiline text editor that stays open while formatting; inherited/disabled hover requires an explicit switch to Custom text. Hidden version text has an explicit editing action. The normal viewer keeps the client’s count/version exclusivity and passive tooltips.

Options separate `document` from `context`: the document is persistent intent; context contains base status, client protocol/compatibility, placeholder values, font profile, width, scale, server name, ping and animation preference. Do not persist context with the document. Supply measured network data yourself, or label example values in your application.

`features` can disable `motd`, `version`, `icon`, `players`, `hover`, `import`, `export` independently. `readOnly` and `disabled` apply to visual/source commands and contextual tools. External updates are still permitted. Labels can override UI strings by key; visible English strings are the defaults. CSS variables `--mce-accent`, `--mce-line`, `--mce-panel` style the editor; `--mcp-font` selects the renderer font.

**Server entry tools** contains Source and Export, plus Import when an adapter is supplied. Source supports MOTD, custom version text and custom hover as local drafts. Apply validates every edited field and commits them as one source transaction; Cancel discards them. Invalid source stays visible without changing the document. Protected constructs block unsupported format conversion. Export is read-only and available in read-only editors; failed serializers cannot be copied as output.

Server import is optional and explicitly triggered. Supply `imports: {adapter(address,signal), timeoutMs?:10000}`. The application owns transport and authorization. A fetched result is staged for review and changes the document only on Apply. New requests, timeout, Cancel, permission changes and destroy abort old requests. Late results and results arriving after local edits are ignored. Replacing the document invalidates source/import drafts and explains why Apply is disabled. Changing the import adapter also invalidates its pending request. There is no built-in polling or remote proxy dependency.

`normalizeIcon(blob,{crop?,maxBytes?,maxPixels?})` accepts PNG/JPEG and returns a normalized 64×64 PNG. Crop is `{x,y,width,height}` and must be square and inside the source. Defaults: 10 MiB, 16 million decoded pixels. Uploads remain local. Keep backend image validation in the consuming application too.

Preview defaults to a complete menu excerpt. `presentation: "row"` embeds just the entry. `viewportWidth` and optional `viewportHeight` are physical CSS pixels; `guiScale` maps GUI coordinates to CSS pixels. `selected` controls the native selection frame. `background` accepts `auto`, `dirt`, `panorama`, `none`, or `{imageUrl}`; `auto` follows the selected client profile or host assets. Controls change context, never persisted MOTD intent.

PNG uploads preserve alpha. The editor offers a pixel-art image-plus action on icon hover and keyboard focus, and accepts dropped PNG/JPEG files. Uploading opens a local crop draft: move the square or enter crop coordinates, then Apply or Cancel. Replacement and reset are staged too; one Apply is one undoable change. Pending decoding can be cancelled, and stale uploads cannot overwrite a newer draft or replacement document. Read-only/disabled instances and plain previews have no upload action.

To keep assets independent from the npm package, provide a synchronous resolver:

```ts
const context = {
  ...previewContext,
  assetProvider(profile) {
    return approvedAssets[profile.id];
    // {background:{imageUrl:...}, defaultServerIcon:...,
    //  buttons:{normal:...,disabled:...,border:2}, fontFamily:...}
  },
};
```

The host controls URLs and authorization. Blob URLs support local-only image selection; revoke them when the host releases the asset. Font families require host-loaded CSS and appropriate matching profile metrics. Explicit background choices override provider defaults. Assets are not serialized, uploaded or copied into server status. Missing provider entries use local original illustrations. Hosting alone does not grant redistribution rights.

Mojang's [EULA](https://www.minecraft.net/en-us/eula) generally restricts redistribution of its content. The [Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines) separately permit screenshots under conditions; they are not a blanket license for distributing extracted textures. This implementation ships original illustrations/OFL fonts and a configurable integration boundary. Before hosting original game files publicly, obtain applicable permission or a project-specific rights review. Local use of user-supplied resources avoids shipping those files from this library; it does not transfer ownership or create a general license.

NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.

Use `createComparison` (DOM) or `ServerListComparison` (optional React) to compare one document across independent client contexts. See [comparison.md](comparison.md) for lifecycle, diagnostics and examples.

The inline MOTD editor accepts changes only within two measured visual lines.
This includes soft wraps and resolved placeholders, not just explicit newlines.
Rejected changes do not rewrite source or add undo steps. Source editing and
imports preserve overlong documents; their extra lines remain available without
scrolling the two visible rows. Existing overflow can be shortened or cleared,
but new hidden growth is rejected. Browser spellcheck is disabled on inline text
surfaces; focusing a field adds no synthetic underline to the client rendering.
