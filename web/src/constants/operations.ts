import type { ReportItem } from "../types/report";

export type CouncilZoneId =
  | "all"
  | "cmc-north"
  | "cmc-cinnamon"
  | "cmc-south"
  | "dmmc"
  | "kmc"
  | "kandy"
  | "galle";

export interface CouncilZoneDefinition {
  id: CouncilZoneId;
  workerPrefixes: string[];
  bounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
}

export const COUNCIL_ZONES: CouncilZoneDefinition[] = [
  { id: "all", workerPrefixes: [] },
  {
    id: "cmc-north",
    workerPrefixes: ["cmc-04"],
    bounds: { minLat: 6.928, maxLat: 6.99, minLon: 79.83, maxLon: 79.895 },
  },
  {
    id: "cmc-cinnamon",
    workerPrefixes: ["cmc-11"],
    bounds: { minLat: 6.898, maxLat: 6.935, minLon: 79.855, maxLon: 79.905 },
  },
  {
    id: "cmc-south",
    workerPrefixes: [],
    bounds: { minLat: 6.868, maxLat: 6.912, minLon: 79.84, maxLon: 79.875 },
  },
  {
    id: "dmmc",
    workerPrefixes: ["dmmc"],
    bounds: { minLat: 6.81, maxLat: 6.875, minLon: 79.85, maxLon: 79.905 },
  },
  {
    id: "kmc",
    workerPrefixes: ["kmc"],
    bounds: { minLat: 6.885, maxLat: 6.97, minLon: 79.9, maxLon: 80.025 },
  },
  {
    id: "kandy",
    workerPrefixes: ["gmc", "kandy"],
    bounds: { minLat: 7.24, maxLat: 7.35, minLon: 80.57, maxLon: 80.7 },
  },
  {
    id: "galle",
    workerPrefixes: ["galle"],
    bounds: { minLat: 5.995, maxLat: 6.09, minLon: 80.17, maxLon: 80.27 },
  },
];

export const WORKER_PRESET_IDS = [
  "cmc-04",
  "cmc-11",
  "kmc-02",
  "dmmc-01",
  "gmc-01",
] as const;

export type WorkerPresetId = (typeof WORKER_PRESET_IDS)[number];

/** Matches a report against a selected Municipal Council zone via worker prefix or GPS bounds. */
export function doesReportMatchZone(
  report: Pick<ReportItem, "latitude" | "longitude" | "assignedWorkerId">,
  zoneId: CouncilZoneId
): boolean {
  if (zoneId === "all") return true;
  const zone = COUNCIL_ZONES.find((z) => z.id === zoneId);
  if (!zone) return true;

  const assignedId = report.assignedWorkerId?.toLowerCase() ?? "";
  if (assignedId && zone.workerPrefixes.some((prefix) => assignedId.startsWith(prefix))) {
    return true;
  }

  if (!zone.bounds) return false;
  const { minLat, maxLat, minLon, maxLon } = zone.bounds;
  return (
    report.latitude >= minLat &&
    report.latitude <= maxLat &&
    report.longitude >= minLon &&
    report.longitude <= maxLon
  );
}
