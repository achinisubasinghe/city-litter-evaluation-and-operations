import type { Id } from "../../../convex/_generated/dataModel";

export type ReportStatus = "pending" | "in_progress" | "resolved" | "rejected";
export type StatusFilter = "all" | ReportStatus;
export type AppRoute = "/" | "/assign";
export type AssignQueueFilter = "pending" | "in_progress" | "active";

export interface ReportItem {
  _id: Id<"reports">;
  _creationTime: number;
  userId: string;
  userName?: string;
  chatId: string;
  imageUrl: string | null;
  proofImageUrl: string | null;
  latitude: number;
  longitude: number;
  confidence?: number;
  status: ReportStatus;
  caption?: string;
  createdAt: number;
  rawLatitude?: number;
  rawLongitude?: number;
  isLocationCorrected?: boolean;
  correctionMethod?: string;
  speedKmh?: number;
  heading?: number;
  offsetMeters?: number;
  qualityScore?: number;
  blurScore?: number;
  resolvedAt?: number;
  resolvedBy?: string;
  resolutionNotes?: string;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  assignedAt?: number;
}

export interface LightboxModalData {
  url: string;
  title: string;
  meta?: string;
}
