import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSaveHealth } from "../src/components/save-editor/save-health.ts";

const readableSave = Object.freeze({
  game_version: "1.58",
  compatibility_warning: null,
  money_account: "125000",
  experience_points: "27000",
});

test("fully available save metadata reports no issues", () => {
  const result = evaluateSaveHealth(readableSave);
  assert.equal(result.level, "good");
  assert.equal(result.score, 100);
  assert.deepEqual(
    result.findings.map(({ level }) => level),
    ["good", "good", "good"],
  );
});

test("compatibility warnings are surfaced as warnings", () => {
  const result = evaluateSaveHealth({
    ...readableSave,
    compatibility_warning: "Game version mismatch",
  });
  assert.equal(result.level, "warning");
  assert.equal(result.score, 65);
  assert.equal(result.findings.find(({ key }) => key === "compatibility")?.level, "warning");
});

test("health score lowers when important save fields cannot be confirmed", () => {
  const result = evaluateSaveHealth({
    ...readableSave,
    game_version: null,
    experience_points: null,
  });
  assert.equal(result.score, 70);
});

test("unknown version and missing career values request review without changing the data", () => {
  const incompleteSave = Object.freeze({
    ...readableSave,
    game_version: null,
    experience_points: null,
  });
  const before = structuredClone(incompleteSave);
  const result = evaluateSaveHealth(incompleteSave);
  assert.equal(result.level, "review");
  assert.deepEqual(incompleteSave, before);
});

test("blank career values are treated as missing", () => {
  const result = evaluateSaveHealth({ ...readableSave, experience_points: "  " });
  assert.equal(result.level, "review");
  assert.equal(result.findings.find(({ key }) => key === "career-data")?.level, "review");
});
