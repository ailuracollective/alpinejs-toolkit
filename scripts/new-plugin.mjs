#!/usr/bin/env node
// Scaffold a new plugin from packages/plugin-template.
// Usage: pnpm run new:plugin -- my-plugin

import { existsSync } from "node:fs";
import { cp, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const raw = process.argv.slice(2).find((a) => !a.startsWith("-"));

if (!raw || !/^[a-z0-9][a-z0-9-]*$/.test(raw)) {
  console.error("Usage: pnpm run new:plugin -- my-plugin");
  process.exit(1);
}

const kebab = raw;
const camel = kebab.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const dest = join(root, "packages", kebab);

if (existsSync(dest)) {
  console.error(`packages/${kebab} already exists`);
  process.exit(1);
}

await cp(join(root, "packages", "plugin-template"), dest, { recursive: true });

// Rename dotfiles copied without leading dot (npm ignores some dotfiles).
for (const f of await readdir(dest)) {
  if (f === "gitignore") await rename(join(dest, f), join(dest, ".gitignore"));
}

async function replaceTokens(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      await replaceTokens(p);
    } else if (/\.(json|ts|md|html|mjs)$/.test(entry.name)) {
      const content = await readFile(p, "utf8");
      await writeFile(
        p,
        content.replaceAll("plugin-template", kebab).replaceAll("pluginTemplate", camel)
      );
    }
  }
}

await replaceTokens(dest);
console.log(
  `Created packages/${kebab}. Add { "path": "./packages/${kebab}" } to tsconfig.json references.`
);
