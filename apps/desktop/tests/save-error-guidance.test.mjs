import assert from "node:assert/strict";
import test from "node:test";
import { classifySaveError } from "../src/components/save-editor/save-error-guidance.ts";

test("classifies common save failures while preserving their original message", () => {
  assert.equal(classifySaveError("Crypto error: ScsC HMAC verification failed"), "hmac");
  assert.equal(classifySaveError("Permission denied reading save"), "permission");
  assert.equal(classifySaveError("Save file not found"), "missing");
  assert.equal(classifySaveError("Unexpected parser failure"), "general");
});
