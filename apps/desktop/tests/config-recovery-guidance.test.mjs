import assert from "node:assert/strict";
import test from "node:test";
import { getConfigRecoveryState } from "../src/components/config-editor/config-recovery.ts";

test("missing config offers discovery retry and game-path recovery", () => {
  const state = getConfigRecoveryState({ configCount: 0, loadError: null, discoveryError: null });
  assert.equal(state.message, "missing");
  assert.equal(state.retry, "scan");
  assert.equal(state.openSettings, true);
});

test("load failure offers retrying the selected file and game-path recovery", () => {
  const state = getConfigRecoveryState({
    configCount: 1,
    selectedPath: "C:/Games/Euro Truck Simulator 2/config.cfg",
    loadError: "permission denied",
    discoveryError: null,
  });
  assert.equal(state.message, "load-error");
  assert.equal(state.retry, "load");
  assert.equal(state.openSettings, true);
});

test("discovery failure remains distinct from a successful scan with no files", () => {
  const failed = getConfigRecoveryState({ configCount: 0, loadError: null, discoveryError: "denied" });
  const empty = getConfigRecoveryState({ configCount: 0, loadError: null, discoveryError: null });
  assert.equal(failed.message, "discovery-error");
  assert.equal(failed.retry, "scan");
  assert.equal(empty.message, "missing");
});
