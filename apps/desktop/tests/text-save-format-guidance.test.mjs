import assert from "node:assert/strict";
import test from "node:test";
import { getTextSaveReadOnlyMessage } from "../src/components/save-editor/text-save-format-guidance.ts";

test("does not show the read-only warning while read-only mode is off", () => {
  assert.equal(getTextSaveReadOnlyMessage(false), null);
});

test("shows the read-only warning while read-only mode is on", () => {
  assert.equal(
    getTextSaveReadOnlyMessage(true),
    "Read Only is enabled. Turn it off in Settings before changing the config.",
  );
});
