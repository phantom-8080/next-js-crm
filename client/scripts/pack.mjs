import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const clientDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = join(clientDir, "..", "build");
const distDir = join(clientDir, "dist");
const standaloneDir = join(distDir, "standalone");

function log(msg) {
  console.log(`[pack] ${msg}`);
}

if (!existsSync(standaloneDir)) {
  console.error(
    '[pack] dist/standalone/ not found. Make sure next.config.ts has output: "standalone" and run "next build" first.',
  );
  process.exit(1);
}

// 1. Clean build directory
log("Cleaning build directory...");
if (existsSync(buildDir)) {
  rmSync(buildDir, { recursive: true, force: true });
}
mkdirSync(buildDir, { recursive: true });

// 2. Copy standalone output (server.js, traced node_modules, server-side dist)
log("Copying standalone output...");
cpSync(standaloneDir, buildDir, { recursive: true });

// 3. Copy static assets (not included in standalone by default)
const staticSrc = join(distDir, "static");
const staticDest = join(buildDir, "dist", "static");
if (existsSync(staticSrc)) {
  log("Copying static assets...");
  cpSync(staticSrc, staticDest, { recursive: true });
}

// 4. Copy public assets
const publicSrc = join(clientDir, "public");
const publicDest = join(buildDir, "public");
if (existsSync(publicSrc)) {
  log("Copying public assets...");
  cpSync(publicSrc, publicDest, { recursive: true });
}

// 5. Copy serve.mjs launcher
log("Copying serve.mjs...");
const scriptsDest = join(buildDir, "scripts");
mkdirSync(scriptsDest, { recursive: true });
cpSync(
  join(clientDir, "scripts", "serve.mjs"),
  join(scriptsDest, "serve.mjs"),
);

// 6. Write production package.json (overwrite the standalone-generated one)
log("Writing production package.json...");
const pkg = {
  name: "client",
  version: "0.1.0",
  private: true,
  scripts: {
    start: "node scripts/serve.mjs",
  },
  engines: {
    node: ">=20",
  },
};
writeFileSync(join(buildDir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");

log("Done — build/ is ready for deployment.");
