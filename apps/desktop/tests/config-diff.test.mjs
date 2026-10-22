import assert from "node:assert/strict";
import test from "node:test";
import { getConfigDiff } from "../src/components/config-editor/config-diff.ts";

test("config preview shows only changes and masks sensitive values", () => {
  const diff = getConfigDiff(
    [
      { key: "g_save_format", value: "2", value_type: "Int", prefix: "", category: "Save" },
      {
        key: "user_token",
        value: "new-secret",
        value_type: "String",
        prefix: "",
        category: "Auth",
      },
      { key: "g_volume", value: "0.5", value_type: "Float", prefix: "", category: "Audio" },
    ],
    ["1", "old-secret", "0.5"],
  );
  assert.deepEqual(diff, [
    { key: "g_save_format", before: "1", after: "2" },
    { key: "user_token", before: "••••••", after: "••••••" },
  ]);
});
