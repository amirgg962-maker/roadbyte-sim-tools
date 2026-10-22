import assert from "node:assert/strict";
import test from "node:test";
import { buildEditPreview } from "../src/components/save-editor/edit-preview.ts";

test("preview lists only real value changes and preserves unset fields", () => {
  assert.deepEqual(buildEditPreview({ money: "1000", xp: "25" }, { money: "2500", xp: "25" }), [
    { key: "money", before: "1,000", after: "2,500" },
  ]);
});

test("preview does not offer unsafe non-integer values", () => {
  assert.deepEqual(buildEditPreview({ money: "1000", xp: null }, { money: "1.5", xp: "900" }), [
    { key: "xp", before: "—", after: "900" },
  ]);
});
