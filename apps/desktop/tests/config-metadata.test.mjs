import assert from "node:assert/strict";
import test from "node:test";
import {
  getConfigMetadata,
  getConfigDisplayCategory,
  inferConfigGame,
  isVerifiedRange,
  LEGACY_SCS_CONFIG_KEYS,
} from "../src/config-metadata.ts";

test("unknown keys do not get guessed descriptions, categories, or ranges", () => {
  const metadata = getConfigMetadata("r_mystery_option", "ets2");
  assert.equal(metadata.evidence, "unknown");
  assert.equal(metadata.description, undefined);
  assert.equal(metadata.category, undefined);
  assert.equal(metadata.range, undefined);
  assert.equal(metadata.allowedValues, undefined);
});

test("legacy SCS bounds remain visible as history but cannot authorize a slider", () => {
  const metadata = getConfigMetadata("g_traffic", "ets2");
  assert.equal(metadata.evidence, "legacy-primary");
  assert.deepEqual(metadata.range, { min: 0, max: 10, step: 0.1 });
  assert.equal(isVerifiedRange(metadata, "ets2", "1.56"), false);
});

test("app-provided guidance remains classified as unverified app guidance", () => {
  const metadata = getConfigMetadata("r_example", "ets2", undefined, {
    description: "Roadbyte hint",
    range: { min: 0, max: 100, step: 1 },
  });
  assert.equal(metadata.evidence, "app-guidance");
  assert.equal(metadata.description, "Roadbyte hint");
  assert.equal(metadata.category, undefined);
  assert.equal(isVerifiedRange(metadata), false);
});

test("metadata is withheld when game scope is ambiguous", () => {
  assert.equal(getConfigMetadata("g_traffic", "unknown").evidence, "unknown");
});

test("unknown keys with graphics or gameplay prefixes stay unverified", () => {
  assert.equal(getConfigDisplayCategory("r_mystery_option", "ets2"), "Unverified");
  assert.equal(getConfigDisplayCategory("g_mystery_option", "ets2"), "Unverified");
});

test("legacy SCS records do not claim game-specific applicability", () => {
  assert.ok(LEGACY_SCS_CONFIG_KEYS.length > 0);
  for (const key of LEGACY_SCS_CONFIG_KEYS) {
    const ets2 = getConfigMetadata(key, "ets2");
    const ats = getConfigMetadata(key, "ats");
    assert.equal(ets2.evidence, "legacy-primary", key);
    assert.equal(ats.evidence, "legacy-primary", key);
    assert.ok(ets2.source?.includes("modding.scssoft.com"), key);
    assert.ok(ets2.sourceCheckedAt, key);
    assert.ok(ets2.sourceNote?.includes("Legacy SCS"), key);
    assert.equal(ets2.games, undefined, key);
    assert.equal(ats.games, undefined, key);
  }
});

test("known game folder names and Steam app ids resolve game scope", () => {
  assert.equal(inferConfigGame("C:\\Users\\A\\Documents\\Euro Truck Simulator 2\\config.cfg"), "ets2");
  assert.equal(inferConfigGame("C:/Steam/userdata/123/270880/remote/config.cfg"), "ats");
  assert.equal(inferConfigGame("D:\\My Games\\custom-profile\\config.cfg"), "unknown");
});
