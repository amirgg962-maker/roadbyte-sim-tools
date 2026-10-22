import type { SaveData } from "../../types";

export type HealthLevel = "good" | "review" | "warning";
export type HealthFinding = {
  key: "readability" | "compatibility" | "career-data";
  level: HealthLevel;
};

type SaveHealthInput = Pick<
  SaveData,
  "game_version" | "compatibility_warning" | "money_account" | "experience_points"
>;

export function evaluateSaveHealth(data: SaveHealthInput): {
  level: HealthLevel;
  findings: HealthFinding[];
} {
  const findings: HealthFinding[] = [
    { key: "readability", level: "good" },
    {
      key: "compatibility",
      level: data.compatibility_warning ? "warning" : data.game_version ? "good" : "review",
    },
    {
      key: "career-data",
      level: data.money_account?.trim() && data.experience_points?.trim() ? "good" : "review",
    },
  ];

  const level: HealthLevel = findings.some((finding) => finding.level === "warning")
    ? "warning"
    : findings.some((finding) => finding.level === "review")
      ? "review"
      : "good";

  return { level, findings };
}
