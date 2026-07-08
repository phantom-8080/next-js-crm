import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const serverJs = join(root, "server.js");

function log(message) {
  console.log(`[appsail] ${message}`);
}

if (!existsSync(serverJs)) {
  console.error(
    "serve: server.js not found — redeploy with standalone pack (npm run pack in client).",
  );
  process.exit(1);
}

const port =
  process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || "3000";

log(`Starting standalone Next.js on 0.0.0.0:${port}...`);

const child = spawn(process.execPath, [serverJs], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    HOSTNAME: "0.0.0.0",
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
