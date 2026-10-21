# Embedding

Import `@groundsgg/motd/styles.css` once. Package CSS references included fonts; editing makes no external requests. Use DOM handles for Vue/Svelte/custom elements or the optional React entry point. One host per instance; dispose on unmount.

Options separate `document` from `context`: the document is persistent intent; context contains base status, client protocol/compatibility, placeholder values, font profile, width, scale, server name, ping and animation preference. Do not persist context with the document. Supply measured network data yourself, or label example values in your application.

`features` can disable `motd`, `version`, `icon`, `players`, `hover`, `import`, `export` independently. `readOnly` and `disabled` apply to visual/source commands and properties. External updates are still permitted. Labels can override UI strings by key; visible English strings are the defaults. CSS variables `--mce-accent`, `--mce-line`, `--mce-panel` style the editor; `--mcp-font` selects the renderer font.

Server import is optional and explicitly triggered. Supply `imports: {adapter(address,signal), timeoutMs?:10000}`. The application owns transport and authorization. New requests, timeout, rebuild and destroy abort the old request. Late results and results arriving after local edits are ignored. There is no built-in polling or remote proxy dependency.

`normalizeIcon(blob,{crop?,maxBytes?,maxPixels?})` accepts PNG/JPEG and returns a normalized 64×64 PNG. Crop is `{x,y,width,height}` and must be square and inside the source. Defaults: 10 MiB, 16 million decoded pixels. Uploads remain local. Keep backend image validation in the consuming application too.
