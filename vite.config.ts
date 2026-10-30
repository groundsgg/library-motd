import { defineConfig } from "vite";
import { vanillaSpriteDevPlugin } from "./tools/vanilla-sprite-dev.mjs";

export default defineConfig({ plugins: [vanillaSpriteDevPlugin()] });
