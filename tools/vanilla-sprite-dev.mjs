import { open, realpath } from "node:fs/promises";
import { isAbsolute, join, sep } from "node:path";

const prefix = "/_motd/vanilla-sprites/";
const filePattern =
  /^(1\.21\.11|26\.1(?:\.[12])?|26\.[23])\/(manifest\.json|(?:icon|hud|mob_effect)\/[a-z0-9_/-]+-\d+\.png)$/;
const loopback = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

/** Explicit private, same-origin development resources. Not used by production builds. */
export function vanillaSpriteMiddleware(directory) {
  return async (req, res, next) => {
    const pathname = (req.url ?? "").split("?")[0];
    if (!pathname.startsWith(prefix)) return next();
    const end = (status) => {
      res.writeHead(status);
      res.end();
    };
    const relative = pathname.slice(prefix.length);
    if (
      !directory ||
      !isAbsolute(directory) ||
      !loopback.has(req.socket.remoteAddress) ||
      !filePattern.test(relative)
    )
      return end(404);
    if (req.method !== "GET" && req.method !== "HEAD") return end(405);
    let file;
    try {
      const root = await realpath(directory);
      const path = await realpath(join(root, relative));
      if (!path.startsWith(root + sep)) return end(404);
      // Refuse links altogether; a private manifest/image must be an owned regular file.
      if (path !== join(root, relative)) return end(404);
      file = await open(path, "r");
      const limit = relative.endsWith(".json") ? 65536 : 4 * 1024 * 1024;
      const stat = await file.stat();
      if (!stat.isFile() || stat.size > limit) return end(404);
      const bytes = Buffer.alloc(limit + 1);
      let length = 0;
      while (length < bytes.length) {
        const read = await file.read(
          bytes,
          length,
          bytes.length - length,
          null,
        );
        if (!read.bytesRead) break;
        length += read.bytesRead;
      }
      if (length > limit) return end(404);
      res.writeHead(200, {
        "Content-Type": relative.endsWith(".json")
          ? "application/json"
          : "image/png",
        "Content-Length": length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Cross-Origin-Resource-Policy": "same-origin",
      });
      res.end(req.method === "HEAD" ? undefined : bytes.subarray(0, length));
    } catch {
      if (!res.headersSent) end(404);
    } finally {
      await file?.close();
    }
  };
}

export function vanillaSpriteDevPlugin() {
  return {
    name: "motd-private-vanilla-sprites",
    apply: "serve",
    configureServer(server) {
      const directory = process.env.MOTD_VANILLA_SPRITE_DIR;
      if (
        directory &&
        !["127.0.0.1", "localhost", "::1"].includes(server.config.server.host)
      )
        throw new Error(
          "Private Vanilla sprites require an explicitly loopback-bound dev server",
        );
      server.middlewares.use(vanillaSpriteMiddleware(directory));
    },
  };
}
