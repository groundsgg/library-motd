import { cp, mkdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
try { await cp('src/dom/styles.css', 'dist/styles.css'); } catch (error) { if(error.code !== 'ENOENT') throw error; }
