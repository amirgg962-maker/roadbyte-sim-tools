import assert from "node:assert/strict";
import test from "node:test";
import { readActivityLog, recordActivity } from "../src/utils/activity-log.ts";

function createMemoryStorage(initial = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key, nextValue) => {
      value = nextValue;
    },
  };
}

test("activity records are newest-first and capped without filesystem interaction", () => {
  const storage = createMemoryStorage();
  for (let index = 0; index < 105; index += 1) {
    recordActivity("values-edited", "autosave", { storage, now: index, id: String(index) });
  }
  const entries = readActivityLog(storage);
  assert.equal(entries.length, 100);
  assert.equal(entries[0]?.id, "104");
  assert.equal(entries.at(-1)?.id, "5");
});

test("malformed local history is ignored safely", () => {
  assert.deepEqual(readActivityLog(createMemoryStorage("not-json")), []);
  assert.deepEqual(readActivityLog(createMemoryStorage(JSON.stringify([{ kind: "unknown" }]))), []);
});

test("storage failures do not interrupt a save operation", () => {
  const unavailableStorage = {
    getItem: () => null,
    setItem: () => {
      throw new Error("storage unavailable");
    },
  };
  assert.equal(recordActivity("values-edited", "autosave", { storage: unavailableStorage }), null);
});
