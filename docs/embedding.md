# Embedding

Import `@groundsgg/motd/styles.css` once. Package CSS references included fonts; editing makes no external requests. Use DOM handles for Vue/Svelte/custom elements or the optional React entry point. One host per instance; dispose on unmount.

Options separate `document` from `context`: the document is persistent intent; context contains base status, client protocol/compatibility, placeholder values, font profile, width, scale, server name, ping and animation preference. Do not persist context with the document. Supply measured network data yourself, or label example values in your application.

`features` can disable `motd`, `version`, `icon`, `players`, `hover`, `import`, `export` independently. `readOnly` and `disabled` apply to visual/source commands and properties. External updates are still permitted. Labels can override UI strings by key; visible English strings are the defaults. CSS variables `--mce-accent`, `--mce-line`, `--mce-panel` style the editor; `--mcp-font` selects the renderer font.

Server import is optional and explicitly triggered. Supply `imports: {adapter(address,signal), timeoutMs?:10000}`. The application owns transport and authorization. New requests, timeout, rebuild and destroy abort the old request. Late results and results arriving after local edits are ignored. There is no built-in polling or remote proxy dependency.

`normalizeIcon(blob,{crop?,maxBytes?,maxPixels?})` accepts PNG/JPEG and returns a normalized 64×64 PNG. Crop is `{x,y,width,height}` and must be square and inside the source. Defaults: 10 MiB, 16 million decoded pixels. Uploads remain local. Keep backend image validation in the consuming application too.

Preview defaults to a complete menu excerpt. `presentation: "row"` embeds just the entry. `viewportWidth` and optional `viewportHeight` are physical CSS pixels; `guiScale` maps GUI coordinates to CSS pixels. `selected` controls the native selection frame. `background` accepts `auto`, `dirt`, `panorama`, `none`, or `{imageUrl}`; `auto` follows the selected client profile or host assets. Controls change context, never persisted MOTD intent.

PNG uploads preserve alpha. The editor offers a pixel-art image-plus upload button on icon hover and keyboard focus; read-only/disabled instances and plain previews have no upload action.

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
