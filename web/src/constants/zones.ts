import type { ReportItem } from "../types/reports";

export type ZoneId =
  | "all"
  | "cmc-north"
  | "cmc-cinnamon"
  | "cmc-south"
  | "dmmc"
  | "kmc"
  | "kandy"
  | "galle";

interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface ZoneRule {
  id: ZoneId;
  bounds: GeoBounds;
  workerPrefixes: string[];
}

export interface WorkerPreset {
  id: string;
  plate: string;
  unitCode: string;
  zoneId: Exclude<ZoneId, "all">;
}

export const WORKER_PRESETS: WorkerPreset[] = [
  { id: "cmc-04", plate: "WP DAE-4920", unitCode: "CMC-04", zoneId: "cmc-north" },
  { id: "cmc-11", plate: "WP DAE-8114", unitCode: "CMC-11", zoneId: "cmc-cinnamon" },
  { id: "kmc-02", plate: "WP NB-3042", unitCode: "KMC-02", zoneId: "kmc" },
  { id: "dmmc-01", plate: "WP NA-7719", unitCode: "DMMC-01", zoneId: "dmmc" },
  { id: "gmc-01", plate: "CP DAE-1120", unitCode: "KMC-01", zoneId: "kandy" },
];

export const ZONE_RULES: ZoneRule[] = [
  {
    id: "cmc-north",
    bounds: { minLat: 6.928, maxLat: 6.995, minLon: 79.835, maxLon: 79.895 },
    workerPrefixes: ["cmc-04", "colombo north", "fort"],
  },
  {
    id: "cmc-cinnamon",
    bounds: { minLat: 6.898, maxLat: 6.928, minLon: 79.855, maxLon: 79.905 },
    workerPrefixes: ["cmc-11", "cinnamon", "borella"],
  },
  {
    id: "cmc-south",
    bounds: { minLat: 6.872, maxLat: 6.915, minLon: 79.84, maxLon: 79.872 },
    workerPrefixes: ["cmc-south", "kollupitiya", "bambalapitiya"],
  },
  {
    id: "dmmc",
    bounds: { minLat: 6.805, maxLat: 6.872, minLon: 79.855, maxLon: 79.91 },
    workerPrefixes: ["dmmc", "dehiwala", "mount lavinia"],
  },
  {
    id: "kmc",
    bounds: { minLat: 6.88, maxLat: 6.975, minLon: 79.912, maxLon: 80.03 },
    workerPrefixes: ["kmc", "kaduwela"],
  },
  {
    id: "kandy",
    bounds: { minLat: 7.24, maxLat: 7.35, minLon: 80.57, maxLon: 80.7 },
    workerPrefixes: ["gmc-01", "kandy"],
  },
  {
    id: "galle",
    bounds: { minLat: 6.0, maxLat: 6.09, minLon: 80.17, maxLon: 80.265 },
    workerPrefixes: ["galle"],
  },
];

export const ALL_ZONE_IDS: ZoneId[] = [
  "all",
  "cmc-north",
  "cmc-cinnamon",
  "cmc-south",
  "dmmc",
  "kmc",
  "kandy",
  "galle",
];

/**
 * Checks whether a report falls inside the selected Sri Lankan municipal council
 * by GPS bounding box or assigned unit identifier.
 */
export function matchesMunicipalZone(report: ReportItem, zoneId: ZoneId): boolean {
  if (zoneId === "all") return true;
  const rule = ZONE_RULES.find((item) => item.id === zoneId);
  if (!rule) return true;

  const { latitude, longitude, assignedWorkerId, assignedWorkerName } = report;
  const inBounds =
    latitude >= rule.bounds.minLat &&
    latitude <= rule.bounds.maxLat &&
    longitude >= rule.bounds.minLon &&
    longitude <= rule.bounds.maxLon;

  if (inBounds) return true;

  const workerSearch = `${assignedWorkerId ?? ""} ${assignedWorkerName ?? ""}`.toLowerCase();
  return rule.workerPrefixes.some((prefix) => workerSearch.includes(prefix));
}
