import assert from "node:assert/strict";
import test from "node:test";
import { buildRedactedDiagnostics } from "../src/utils/diagnostics-export.js";

test("diagnostics export includes app state but excludes paths and save identity", () => {
  const report = buildRedactedDiagnostics({
    appVersion: "0.3.0",
    platform: "Win32",
    language: "fa",
    gameVersion: "1.60",
    testedGameVersion: "1.60",
    customDirectoryConfigured: true,
    readOnly: true,
    now: new Date("2026-01-01T00:00:00.000Z"),
  });
  const serialized = JSON.stringify(report);
  assert.equal(report.application.version, "0.3.0");
  assert.equal(report.safety.read_only, true);
  assert.doesNotMatch(serialized, /C:\\\\Users|profileName|save contents|config_path/i);
});
