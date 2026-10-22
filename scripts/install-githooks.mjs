import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const gitMarker = resolve(root, ".git");
const hooksDir = resolve(root, ".githooks");

// The source ZIP downloaded from GitHub does not include Git metadata.
// Git hooks are only useful in a real checkout, so never fail dependency
// installation just because the user extracted a ZIP archive.
if (!existsSync(gitMarker)) {
  console.log(
    "[Roadbyte] Git hooks skipped: no .git metadata found. This folder may have been installed from a ZIP archive.",
  );
  process.exit(0);
}

if (!existsSync(hooksDir)) {
  console.log("[Roadbyte] Git hooks skipped: .githooks directory was not found.");
  process.exit(0);
}

const candidates = ["git"];
const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
const localAppData = process.env.LOCALAPPDATA;

for (const base of [programFiles, programFilesX86]) {
  candidates.push(join(base, "Git", "cmd", "git.exe"));
  candidates.push(join(base, "Git", "bin", "git.exe"));
}
if (localAppData) {
  candidates.push(join(localAppData, "Programs", "Git", "cmd", "git.exe"));
}

const tried = new Set();
let configured = false;
let lastError = "Git could not be located or configured.";

for (const candidate of candidates) {
  if (tried.has(candidate)) continue;
  tried.add(candidate);
  if (candidate !== "git" && !existsSync(candidate)) continue;

  const result = spawnSync(
    candidate,
    ["config", "--local", "core.hooksPath", ".githooks"],
    { cwd: root, encoding: "utf8", windowsHide: true },
  );

  if (!result.error && result.status === 0) {
    configured = true;
    break;
  }

  if (result.error?.code === "ENOENT") continue;
  lastError =
    result.stderr?.trim() ||
    result.error?.message ||
    `git config exited with code ${result.status}`;
}

if (configured) {
  console.log("[Roadbyte] Git hooks configured to use .githooks/");
} else {
  // Hook setup is helpful for contributors but must not block pnpm install.
  console.warn(`[Roadbyte] Git hooks were not configured: ${lastError}`);
  console.warn(
    "[Roadbyte] Dependency installation will continue. You can configure hooks later from a Git checkout.",
  );
}
