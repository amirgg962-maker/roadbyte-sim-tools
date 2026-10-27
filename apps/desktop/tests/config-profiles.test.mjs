import assert from "node:assert/strict";
import test from "node:test";
import {
  applyConfigProfile,
  makeConfigProfile,
  previewConfigProfile,
  readConfigProfiles,
  writeConfigProfiles,
} from "../src/components/config-editor/config-profiles.ts";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("config profiles exclude sensitive values and paths, preview changes, and apply only matching keys", () => {
  const storage = memoryStorage();
  const entries = [
    { key: "g_traffic", value: "1", value_type: "Int" },
    { key: "user_token", value: "abc", value_type: "String" },
    { key: "g_save_path", value: "C:\\Users\\Amir", value_type: "String" },
    { key: "unrelated", value: "unchanged", value_type: "String" },
  ];
  const profile = makeConfigProfile(
    "Quiet traffic",
    "ets2",
    [
      { key: "g_traffic", value: "0" },
      { key: "user_token", value: "private" },
      { key: "g_save_path", value: "D:\\Private" },
      { key: "removed_later", value: "ignored" },
    ],
    new Date("2026-01-01T00:00:00.000Z"),
  );
  writeConfigProfiles(storage, [profile]);
  const [loaded] = readConfigProfiles(storage);
  assert.equal(loaded.name, "Quiet traffic");
  assert.equal(Object.hasOwn(loaded.values, "user_token"), false);
  assert.equal(Object.hasOwn(loaded.values, "g_save_path"), false);
  assert.deepEqual(previewConfigProfile(loaded, entries), [
    { key: "g_traffic", before: "1", after: "0" },
  ]);
  assert.deepEqual(
    applyConfigProfile(loaded, entries).map(({ value }) => value),
    ["0", "abc", "C:\\Users\\Amir", "unchanged"],
  );
});

test("malformed local profile storage is ignored", () => {
  assert.deepEqual(readConfigProfiles({ getItem: () => "{" }), []);
});
