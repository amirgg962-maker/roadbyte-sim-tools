import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCareerMilestones,
  buildSaveStory,
  compareSaveSnapshots,
  diffMods,
  filterFleet,
  summarizeSaveDelta,
} from "../src/utils/roadbyte-workbench.js";

test("save timeline highlights changed career and fleet metrics", () => {
  const before = { money: 100, xp: 20, level: 2, trucks_count: 1, drivers_count: 1 };
  const after = { money: 150, xp: 20, level: 2, trucks_count: 2, drivers_count: 1 };
  assert.deepEqual(summarizeSaveDelta(before, after), [
    { key: "money", before: 100, after: 150, delta: 50 },
    { key: "trucks_count", before: 1, after: 2, delta: 1 },
  ]);
});

test("profile comparison leaves unknown values explicitly unavailable", () => {
  assert.deepEqual(compareSaveSnapshots({ money: 100, xp: null }, { money: 80, xp: 5 }), [
    { key: "money", left: 100, right: 80, delta: -20 },
    { key: "xp", left: null, right: 5, delta: null },
  ]);
});

test("fleet filters select trucks needing attention without mutating source", () => {
  const fleet = [
    { index: 0, fuel_relative: 0.1, engine_wear: 0.2 },
    { index: 1, fuel_relative: 0.8, engine_wear: 0.7 },
  ];
  assert.deepEqual(
    filterFleet(fleet, "attention").map((truck) => truck.index),
    [0, 1],
  );
  assert.deepEqual(
    filterFleet(fleet, "low-fuel").map((truck) => truck.index),
    [0],
  );
  assert.equal(fleet[0].fuel_relative, 0.1);
});

test("mod impact map compares mods case-insensitively while preserving display names", () => {
  assert.deepEqual(
    diffMods(["Real Company Mod", "Map Pack"], ["real company mod", "Sound Fixes"]),
    {
      added: ["Sound Fixes"],
      removed: ["Map Pack"],
    },
  );
});

test("career constellation marks milestones using only known save metrics", () => {
  const result = buildCareerMilestones({
    xp: 9000,
    visited_cities_count: 4,
    trucks_count: null,
    achieved_feats: 2,
    total_distance_km: 12000,
  });
  assert.deepEqual(
    result.map(({ key, reached }) => [key, reached]),
    [
      ["first-delivery", true],
      ["city-explorer", false],
      ["fleet-owner", null],
      ["achievement-hunter", true],
      ["road-veteran", true],
    ],
  );
});

test("save story merges local activity and backup events newest first", () => {
  const story = buildSaveStory(
    [
      {
        path: "backup",
        displayName: "before edit",
        createdAt: "20261024_120000",
        backupType: "save",
      },
    ],
    [
      {
        id: "activity",
        kind: "values-edited",
        timestamp: Date.parse("2026-10-24T13:00:00Z"),
        saveName: "autosave",
      },
    ],
  );
  assert.deepEqual(
    story.map(({ kind }) => kind),
    ["values-edited", "backup"],
  );
});
