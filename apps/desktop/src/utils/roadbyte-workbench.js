const CAREER_FIELDS = [
  "money",
  "xp",
  "level",
  "trucks_count",
  "drivers_count",
  "total_distance_km",
  "total_fuel_litres",
  "visited_cities_count",
  "achieved_feats",
  "discovered_items",
  "save_version",
];

export function summarizeSaveDelta(before, after) {
  return CAREER_FIELDS.flatMap((key) => {
    const left = before?.[key];
    const right = after?.[key];
    if (left == null || right == null || left === right) return [];
    return [{ key, before: left, after: right, delta: right - left }];
  });
}

export function compareSaveSnapshots(left, right) {
  return CAREER_FIELDS.flatMap((key) => {
    const a = left?.[key] ?? null;
    const b = right?.[key] ?? null;
    if (a == null && b == null) return [];
    return [{ key, left: a, right: b, delta: a == null || b == null ? null : b - a }];
  });
}

export function filterFleet(trucks, filter) {
  if (filter === "low-fuel")
    return trucks.filter((truck) => truck.fuel_relative != null && truck.fuel_relative <= 0.25);
  if (filter === "high-wear")
    return trucks.filter((truck) =>
      [truck.engine_wear, truck.transmission_wear, truck.cabin_wear, truck.chassis_wear].some(
        (wear) => wear != null && wear >= 0.5,
      ),
    );
  if (filter === "attention")
    return trucks.filter(
      (truck) =>
        (truck.fuel_relative != null && truck.fuel_relative <= 0.25) ||
        [truck.engine_wear, truck.transmission_wear, truck.cabin_wear, truck.chassis_wear].some(
          (wear) => wear != null && wear >= 0.5,
        ),
    );
  return trucks;
}

export function diffMods(left = [], right = []) {
  const leftByName = new Map(left.map((name) => [name.trim().toLowerCase(), name.trim()]));
  const rightByName = new Map(right.map((name) => [name.trim().toLowerCase(), name.trim()]));
  return {
    added: [...rightByName].filter(([key]) => !leftByName.has(key)).map(([, name]) => name),
    removed: [...leftByName].filter(([key]) => !rightByName.has(key)).map(([, name]) => name),
  };
}

export function buildCareerMilestones(data) {
  const milestones = [
    ["first-delivery", data.xp, 1000],
    ["city-explorer", data.visited_cities_count, 10],
    ["fleet-owner", data.trucks_count, 1],
    ["achievement-hunter", data.achieved_feats, 1],
    ["road-veteran", data.total_distance_km, 10000],
  ];
  return milestones.map(([key, value, threshold]) => ({
    key,
    reached: value == null ? null : value >= threshold,
    progress: value == null ? null : Math.min(1, Math.max(0, value / threshold)),
  }));
}

function backupTimestamp(value) {
  const match = /^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/.exec(value);
  if (!match) return Date.parse(value);
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  ).getTime();
}

export function buildSaveStory(backups, activities) {
  const backupEvents = backups
    .filter((backup) => backup.backupType === "save")
    .map((backup) => ({
      id: `backup:${backup.path}`,
      kind: "backup",
      timestamp: backupTimestamp(backup.createdAt),
      saveName: backup.displayName || backup.name || "Backup",
    }))
    .filter((entry) => Number.isFinite(entry.timestamp));
  return [...backupEvents, ...activities].sort((a, b) => b.timestamp - a.timestamp);
}
