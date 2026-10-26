import assert from "node:assert/strict";
import test from "node:test";
import {
  getConfigMetadata,
  getNumericControlState,
  LEGACY_SCS_CONFIG_KEYS,
} from "../src/config-metadata.ts";
import { CONFIG_RANGES } from "../src/config-ranges.ts";
import { CONFIG_DESCRIPTIONS } from "../src/config-descriptions.ts";

const currentMetadata = {
  evidence: "current-primary",
  games: ["ets2"],
  validGameVersions: ["1.56"],
  range: { min: 0, max: 10, step: 0.5 },
};

test("verified range allows a slider only for its game and version", () => {
  const state = getNumericControlState("5", currentMetadata, "ets2", "1.56");
  assert.equal(state.showSlider, true);
  assert.equal(state.value, "5");
  assert.deepEqual(state.range, currentMetadata.range);
});

test("legacy or app guidance ranges never activate a slider", () => {
  const legacy = getNumericControlState("12.00", {
    ...currentMetadata,
    evidence: "legacy-primary",
  }, "ets2", "1.56");
  assert.equal(legacy.showSlider, false);
  assert.equal(legacy.value, "12.00");

  const appHint = getNumericControlState("3", {
    ...currentMetadata,
    evidence: "app-guidance",
  }, "ets2", "1.56");
  assert.equal(appHint.showSlider, false);
});

test("out-of-range values stay exact and are not clamped by a slider", () => {
  const state = getNumericControlState("99.000", currentMetadata, "ets2", "1.56");
  assert.equal(state.showSlider, false);
  assert.equal(state.value, "99.000");
  assert.equal(state.outOfRange, true);
});

test("version or game mismatch keeps exact-input editing", () => {
  assert.equal(getNumericControlState("5", currentMetadata, "ats", "1.56").showSlider, false);
  assert.equal(getNumericControlState("5", currentMetadata, "ets2", "1.57").showSlider, false);
});

test("existing app ranges stay guidance-only until independently verified", () => {
  for (const [key, range] of Object.entries(CONFIG_RANGES)) {
    const state = getNumericControlState("1", {
      evidence: "app-guidance",
      range,
    }, "ets2", "1.56");
    assert.equal(state.showSlider, false, key);
  }
});

test("existing descriptions are consistently classified as app guidance", () => {
  for (const [key, description] of Object.entries(CONFIG_DESCRIPTIONS)) {
    const metadata = getConfigMetadata(key, "ets2", "1.56", { description });
    assert.ok(
      metadata.evidence === "app-guidance" || LEGACY_SCS_CONFIG_KEYS.includes(key),
      key,
    );
    if (metadata.evidence === "app-guidance") assert.equal(metadata.description, description, key);
  }
});
