import type { TruckInfo } from "../types";

export interface SaveDelta {
  key: string;
  before: number;
  after: number;
  delta: number;
}

export interface SnapshotComparison {
  key: string;
  left: number | null;
  right: number | null;
  delta: number | null;
}

export interface CareerSnapshot {
  money?: number | null;
  xp?: number | null;
  level?: number | null;
  trucks_count?: number | null;
  drivers_count?: number | null;
  total_distance_km?: number | null;
  total_fuel_litres?: number | null;
  visited_cities_count?: number | null;
  achieved_feats?: number | null;
  discovered_items?: number | null;
  save_version?: number | null;
}

export function summarizeSaveDelta(before: CareerSnapshot, after: CareerSnapshot): SaveDelta[];
export function compareSaveSnapshots(
  left: CareerSnapshot | null,
  right: CareerSnapshot | null,
): SnapshotComparison[];
export function filterFleet(trucks: TruckInfo[], filter: string): TruckInfo[];
export function diffMods(left: string[], right: string[]): { added: string[]; removed: string[] };
export function buildCareerMilestones(data: {
  xp: number | null;
  visited_cities_count: number | null;
  trucks_count: number | null;
  achieved_feats: number | null;
  total_distance_km: number | null;
}): Array<{ key: string; reached: boolean | null; progress: number | null }>;
export function buildSaveStory(
  backups: Array<{
    path: string;
    displayName?: string;
    name?: string;
    createdAt: string;
    backupType: string;
  }>,
  activities: Array<{ id: string; kind: string; timestamp: number; saveName: string }>,
): Array<{ id: string; kind: string; timestamp: number; saveName: string }>;
