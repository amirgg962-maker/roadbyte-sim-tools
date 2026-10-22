import assert from "node:assert/strict";
import test from "node:test";
import { getSaveLoadStartState } from "../src/components/save-editor/save-load-state.ts";

test("clears the previously loaded save before loading a different save", () => {
  const previousSave = { money_account: "500000" };

  assert.deepEqual(getSaveLoadStartState(previousSave), {
    saveData: null,
    loadError: null,
    isLoading: true,
  });
});
