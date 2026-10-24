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
  score: number;
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

  const score = Math.max(
    0,
    100 -
      findings.reduce((penalty, finding) => {
        if (finding.level === "warning") return penalty + 35;
        if (finding.level === "review") return penalty + 15;
        return penalty;
      }, 0),
  );

  return { level, score, findings };
}
