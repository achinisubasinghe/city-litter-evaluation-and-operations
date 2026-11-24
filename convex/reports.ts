import { query, mutation, action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const wasteCategoryValidator = v.union(
  v.literal("plastic"),
  v.literal("organic"),
  v.literal("paper"),
  v.literal("metal"),
  v.literal("glass"),
  v.literal("bulky")
);

const reportStatusValidator = v.union(
  v.literal("pending"),
  v.literal("in_progress"),
  v.literal("resolved"),
  v.literal("rejected")
);

const reportSourceValidator = v.union(
  v.literal("citizen_web"),
  v.literal("telegram_bot"),
  v.literal("whatsapp_bot"),
  v.literal("edge_unit")
);

const citizenOptionalFields = {
  ticketCode: v.optional(v.string()),
  wasteCategory: v.optional(wasteCategoryValidator),
  priority: v.optional(v.union(v.literal("normal"), v.literal("high"))),
  reportCount: v.optional(v.number()),
  clusterRadiusMeters: v.optional(v.number()),
  mergedPhotoStorageIds: v.optional(v.array(v.id("_storage"))),
  mergedReporterContacts: v.optional(v.array(v.string())),
  addressLabel: v.optional(v.string()),
  landmarkNote: v.optional(v.string()),
  localAuthority: v.optional(v.string()),
  reporterContact: v.optional(v.string()),
  source: v.optional(reportSourceValidator),
  escalatedAt: v.optional(v.number()),
};

/**
 * Computes WGS-84 great-circle Haversine distance in meters between two GPS coordinates.
 */
function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Normalizes a citizen-entered ticket lookup string (e.g. "#cleo-1038" or "1038") into "CLEO-1038".
 */
function normalizeTicketCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase().replace(/^#/, "");
  if (/^\d+$/.test(trimmed)) {
    return `CLEO-${trimmed}`;
  }
  return trimmed;
}

/**
 * Downloads a photo from a given URL (e.g. Telegram File API)
 * and stores it directly in Convex File Storage.
 */
export const storeImageFromUrl = action({
  args: { url: v.string() },
  returns: v.id("_storage"),
  handler: async (ctx, args) => {
    const res = await fetch(args.url);
    if (!res.ok) {
      throw new Error(`Failed to fetch image from URL: ${res.statusText}`);
    }
    const blob = await res.blob();
    return await ctx.storage.store(blob);
  },
});

/**
 * Saves photo & detection confidence to a user's active draft.
 * If the user's draft already has a location, this completes and creates the final report!
 */
export const saveDraftPhoto = mutation({
  args: {
    userId: v.string(),
    userName: v.optional(v.string()),
    chatId: v.string(),
    photoStorageId: v.id("_storage"),
    confidence: v.optional(v.number()),
    caption: v.optional(v.string()),
  },
  returns: v.object({
    status: v.union(v.literal("draft_updated"), v.literal("completed")),
    reportId: v.optional(v.id("reports")),
  }),
  handler: async (ctx, args) => {
    const existingDraft = await ctx.db
      .query("drafts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (
      existingDraft &&
      existingDraft.latitude !== undefined &&
      existingDraft.longitude !== undefined
    ) {
      // Both photo and location are now available! Create report
      const reportId = await ctx.db.insert("reports", {
        userId: args.userId,
        userName: args.userName ?? existingDraft.userName,
        chatId: args.chatId,
        photoStorageId: args.photoStorageId,
        confidence: args.confidence ?? existingDraft.confidence,
        latitude: existingDraft.latitude,
        longitude: existingDraft.longitude,
        status: "pending",
        caption: args.caption ?? existingDraft.caption,
        createdAt: Date.now(),
      });

      await ctx.db.delete(existingDraft._id);

      return {
        status: "completed" as const,
        reportId,
      };
    }

    if (existingDraft) {
      await ctx.db.patch(existingDraft._id, {
        photoStorageId: args.photoStorageId,
        confidence: args.confidence ?? existingDraft.confidence,
        chatId: args.chatId,
        userName: args.userName ?? existingDraft.userName,
        caption: args.caption ?? existingDraft.caption,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("drafts", {
        userId: args.userId,
        chatId: args.chatId,
        userName: args.userName,
        photoStorageId: args.photoStorageId,
        confidence: args.confidence,
        caption: args.caption,
        updatedAt: Date.now(),
      });
    }

    return {
      status: "draft_updated" as const,
    };
  },
});

/**
 * Saves location to a user's active draft.
 * If the user's draft already has a photo, this completes and creates the final report!
 */
export const saveDraftLocation = mutation({
  args: {
    userId: v.string(),
    userName: v.optional(v.string()),
    chatId: v.string(),
    latitude: v.number(),
    longitude: v.number(),
  },
  returns: v.object({
    status: v.union(v.literal("draft_updated"), v.literal("completed")),
    reportId: v.optional(v.id("reports")),
  }),
  handler: async (ctx, args) => {
    const existingDraft = await ctx.db
      .query("drafts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();

    if (existingDraft && existingDraft.photoStorageId !== undefined) {
      // Both photo and location are now available! Create report
      const reportId = await ctx.db.insert("reports", {
        userId: args.userId,
        userName: args.userName ?? existingDraft.userName,
        chatId: args.chatId,
        photoStorageId: existingDraft.photoStorageId,
        confidence: existingDraft.confidence,
        latitude: args.latitude,
        longitude: args.longitude,
        status: "pending",
        caption: existingDraft.caption,
        createdAt: Date.now(),
      });

      await ctx.db.delete(existingDraft._id);

      return {
        status: "completed" as const,
        reportId,
      };
    }

    if (existingDraft) {
      await ctx.db.patch(existingDraft._id, {
        latitude: args.latitude,
        longitude: args.longitude,
        chatId: args.chatId,
        userName: args.userName ?? existingDraft.userName,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("drafts", {
        userId: args.userId,
        chatId: args.chatId,
        userName: args.userName,
        latitude: args.latitude,
        longitude: args.longitude,
        updatedAt: Date.now(),
      });
    }

    return {
      status: "draft_updated" as const,
    };
  },
});

/**
 * Clears any active draft for a user (called when user sends /cancel).
 */
export const clearDraft = mutation({
  args: { userId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existingDraft = await ctx.db
      .query("drafts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
    if (existingDraft) {
      await ctx.db.delete(existingDraft._id);
      return true;
    }
    return false;
  },
});

/**
 * Gets active draft for a user.
 */
export const getDraft = query({
  args: { userId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("drafts"),
      _creationTime: v.number(),
      userId: v.string(),
      chatId: v.string(),
      userName: v.optional(v.string()),
      photoStorageId: v.optional(v.id("_storage")),
      confidence: v.optional(v.number()),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      caption: v.optional(v.string()),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("drafts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first();
  },
});

/**
 * Lists all reports with signed image URLs resolved from Convex file storage.
 */
export const listReports = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("reports"),
      _creationTime: v.number(),
      userId: v.string(),
      userName: v.optional(v.string()),
      chatId: v.string(),
      photoStorageId: v.id("_storage"),
      imageUrl: v.union(v.string(), v.null()),
      latitude: v.number(),
      longitude: v.number(),
      confidence: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("resolved"),
        v.literal("rejected")
      ),
      caption: v.optional(v.string()),
      createdAt: v.number(),
      rawLatitude: v.optional(v.number()),
      rawLongitude: v.optional(v.number()),
      isLocationCorrected: v.optional(v.boolean()),
      correctionMethod: v.optional(v.string()),
      speedKmh: v.optional(v.number()),
      heading: v.optional(v.number()),
      offsetMeters: v.optional(v.number()),
      qualityScore: v.optional(v.number()),
      blurScore: v.optional(v.number()),
      proofPhotoStorageId: v.optional(v.id("_storage")),
      proofImageUrl: v.union(v.string(), v.null()),
      resolvedAt: v.optional(v.number()),
      resolvedBy: v.optional(v.string()),
      resolutionNotes: v.optional(v.string()),
      assignedWorkerId: v.optional(v.string()),
      assignedWorkerName: v.optional(v.string()),
      assignedAt: v.optional(v.number()),
      ...citizenOptionalFields,
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const reports = await ctx.db.query("reports").order("desc").take(limit);

    return await Promise.all(
      reports.map(async (r) => {
        const imageUrl = await ctx.storage.getUrl(r.photoStorageId);
        const proofImageUrl = r.proofPhotoStorageId
          ? await ctx.storage.getUrl(r.proofPhotoStorageId)
          : null;
        return {
          ...r,
          imageUrl,
          proofImageUrl,
        };
      })
    );
  },
});

/**
 * Gets a single report by ID with resolved signed URLs for both original and proof photos.
 */
export const getReport = query({
  args: { reportId: v.id("reports") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("reports"),
      _creationTime: v.number(),
      userId: v.string(),
      userName: v.optional(v.string()),
      chatId: v.string(),
      photoStorageId: v.id("_storage"),
      imageUrl: v.union(v.string(), v.null()),
      proofPhotoStorageId: v.optional(v.id("_storage")),
      proofImageUrl: v.union(v.string(), v.null()),
      latitude: v.number(),
      longitude: v.number(),
      confidence: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("resolved"),
        v.literal("rejected")
      ),
      caption: v.optional(v.string()),
      createdAt: v.number(),
      rawLatitude: v.optional(v.number()),
      rawLongitude: v.optional(v.number()),
      isLocationCorrected: v.optional(v.boolean()),
      correctionMethod: v.optional(v.string()),
      speedKmh: v.optional(v.number()),
      heading: v.optional(v.number()),
      offsetMeters: v.optional(v.number()),
      qualityScore: v.optional(v.number()),
      blurScore: v.optional(v.number()),
      resolvedAt: v.optional(v.number()),
      resolvedBy: v.optional(v.string()),
      resolutionNotes: v.optional(v.string()),
      assignedWorkerId: v.optional(v.string()),
      assignedWorkerName: v.optional(v.string()),
      assignedAt: v.optional(v.number()),
      ...citizenOptionalFields,
    })
  ),
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.reportId);
    if (!r) return null;
    const imageUrl = await ctx.storage.getUrl(r.photoStorageId);
    const proofImageUrl = r.proofPhotoStorageId
      ? await ctx.storage.getUrl(r.proofPhotoStorageId)
      : null;
    return {
      ...r,
      imageUrl,
      proofImageUrl,
    };
  },
});

/**
 * Assigns a report to a specific worker and marks it as in_progress.
 */
export const assignReport = mutation({
  args: {
    reportId: v.id("reports"),
    workerId: v.string(),
    workerName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      status: "in_progress",
      assignedWorkerId: args.workerId,
      assignedWorkerName: args.workerName,
      assignedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Resolves a report with photographic proof of collection.
 */
export const resolveReport = mutation({
  args: {
    reportId: v.id("reports"),
    proofPhotoStorageId: v.id("_storage"),
    workerName: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, {
      status: "resolved",
      proofPhotoStorageId: args.proofPhotoStorageId,
      resolvedAt: Date.now(),
      resolvedBy: args.workerName ?? "Worker",
      resolutionNotes: args.notes,
    });
    return null;
  },
});

/**
 * Retrieves reports submitted by a specific user.
 */
export const getReportsByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("reports"),
      _creationTime: v.number(),
      userId: v.string(),
      userName: v.optional(v.string()),
      chatId: v.string(),
      photoStorageId: v.id("_storage"),
      imageUrl: v.union(v.string(), v.null()),
      latitude: v.number(),
      longitude: v.number(),
      confidence: v.optional(v.number()),
      status: v.union(
        v.literal("pending"),
        v.literal("in_progress"),
        v.literal("resolved"),
        v.literal("rejected")
      ),
      caption: v.optional(v.string()),
      createdAt: v.number(),
      rawLatitude: v.optional(v.number()),
      rawLongitude: v.optional(v.number()),
      isLocationCorrected: v.optional(v.boolean()),
      correctionMethod: v.optional(v.string()),
      speedKmh: v.optional(v.number()),
      heading: v.optional(v.number()),
      offsetMeters: v.optional(v.number()),
      qualityScore: v.optional(v.number()),
      blurScore: v.optional(v.number()),
      proofPhotoStorageId: v.optional(v.id("_storage")),
      resolvedAt: v.optional(v.number()),
      resolvedBy: v.optional(v.string()),
      resolutionNotes: v.optional(v.string()),
      assignedWorkerId: v.optional(v.string()),
      assignedWorkerName: v.optional(v.string()),
      assignedAt: v.optional(v.number()),
      ...citizenOptionalFields,
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    const reports = await ctx.db
      .query("reports")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);

    return await Promise.all(
      reports.map(async (r) => {
        const imageUrl = await ctx.storage.getUrl(r.photoStorageId);
        return {
          ...r,
          imageUrl,
        };
      })
    );
  },
});

/**
 * Updates status of a report (e.g. from the dashboard).
 */
export const updateReportStatus = mutation({
  args: {
    reportId: v.id("reports"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("rejected")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, { status: args.status });
    return null;
  },
});

/**
 * Generates a signed upload URL for edge devices to stream images directly into storage.
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

const EARTH_RADIUS_METERS = 6378137.0;
const DEFAULT_EDGE_DEDUP_RADIUS_METERS = 20.0;

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Ingestion mutation specifically for edge hardware units (Raspberry Pi prototype).
 * Inserts the detection directly with offline timestamps and GPS coordinates,
 * deduplicating against nearby unresolved reports within `dedupRadiusMeters`.
 */
export const createReportFromEdge = mutation({
  args: {
    photoStorageId: v.id("_storage"),
    latitude: v.number(),
    longitude: v.number(),
    confidence: v.optional(v.number()),
    createdAt: v.optional(v.number()),
    caption: v.optional(v.string()),
    deviceId: v.optional(v.string()),
    rawLatitude: v.optional(v.number()),
    rawLongitude: v.optional(v.number()),
    isLocationCorrected: v.optional(v.boolean()),
    correctionMethod: v.optional(v.string()),
    speedKmh: v.optional(v.number()),
    heading: v.optional(v.number()),
    offsetMeters: v.optional(v.number()),
    qualityScore: v.optional(v.number()),
    blurScore: v.optional(v.number()),
    dedupRadiusMeters: v.optional(v.number()),
  },
  returns: v.object({
    reportId: v.id("reports"),
    status: v.union(v.literal("created"), v.literal("deduplicated")),
    distanceMeters: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const dedupRadius =
      args.dedupRadiusMeters ?? DEFAULT_EDGE_DEDUP_RADIUS_METERS;

    if (dedupRadius > 0) {
      const [pendingReports, inProgressReports] = await Promise.all([
        ctx.db
          .query("reports")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .order("desc")
          .take(250),
        ctx.db
          .query("reports")
          .withIndex("by_status", (q) => q.eq("status", "in_progress"))
          .order("desc")
          .take(250),
      ]);

      let nearestReportId: (typeof pendingReports)[number]["_id"] | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const existing of [...pendingReports, ...inProgressReports]) {
        const dist = haversineMeters(
          args.latitude,
          args.longitude,
          existing.latitude,
          existing.longitude
        );
        if (dist <= dedupRadius && dist < nearestDistance) {
          nearestDistance = dist;
          nearestReportId = existing._id;
        }
      }

      if (nearestReportId !== null) {
        // Delete redundant uploaded image blob to avoid orphaned storage files
        await ctx.storage.delete(args.photoStorageId);
        return {
          reportId: nearestReportId,
          status: "deduplicated" as const,
          distanceMeters: Math.round(nearestDistance * 10) / 10,
        };
      }
    }

    const reportId = await ctx.db.insert("reports", {
      userId: args.deviceId ?? "rpi-edge-01",
      userName: `Edge Unit (${args.deviceId ?? "Pi-4B"})`,
      chatId: "edge-stream",
      photoStorageId: args.photoStorageId,
      latitude: args.latitude,
      longitude: args.longitude,
      confidence: args.confidence,
      status: "pending",
      caption: args.caption ?? "Autonomous edge detection",
      createdAt: args.createdAt ?? Date.now(),
      rawLatitude: args.rawLatitude,
      rawLongitude: args.rawLongitude,
      isLocationCorrected: args.isLocationCorrected,
      correctionMethod: args.correctionMethod,
      speedKmh: args.speedKmh,
      heading: args.heading,
      offsetMeters: args.offsetMeters,
      qualityScore: args.qualityScore,
      blurScore: args.blurScore,
    });
    return { reportId, status: "created" as const };
  },
});

const citizenReportReturnValidator = v.object({
  _id: v.id("reports"),
  _creationTime: v.number(),
  userId: v.string(),
  userName: v.optional(v.string()),
  chatId: v.string(),
  photoStorageId: v.id("_storage"),
  imageUrl: v.union(v.string(), v.null()),
  proofPhotoStorageId: v.optional(v.id("_storage")),
  proofImageUrl: v.union(v.string(), v.null()),
  mergedImageUrls: v.array(v.string()),
  latitude: v.number(),
  longitude: v.number(),
  confidence: v.optional(v.number()),
  status: reportStatusValidator,
  caption: v.optional(v.string()),
  createdAt: v.number(),
  rawLatitude: v.optional(v.number()),
  rawLongitude: v.optional(v.number()),
  isLocationCorrected: v.optional(v.boolean()),
  correctionMethod: v.optional(v.string()),
  speedKmh: v.optional(v.number()),
  heading: v.optional(v.number()),
  offsetMeters: v.optional(v.number()),
  qualityScore: v.optional(v.number()),
  blurScore: v.optional(v.number()),
  resolvedAt: v.optional(v.number()),
  resolvedBy: v.optional(v.string()),
  resolutionNotes: v.optional(v.string()),
  assignedWorkerId: v.optional(v.string()),
  assignedWorkerName: v.optional(v.string()),
  assignedAt: v.optional(v.number()),
  ...citizenOptionalFields,
});

/**
 * Citizen crowdsource report submission with 20m Haversine spatial clustering.
 * - If an active (pending / in_progress) report exists within clusterRadiusMeters (default 20m),
 *   merges this report into it, increments reportCount, and escalates priority to "high" (Outcome B).
 * - Otherwise, creates a new ticket with a unique #CLEO-XXXX ticketCode and "normal" priority (Outcome A).
 */
export const submitCitizenReport = mutation({
  args: {
    photoStorageId: v.id("_storage"),
    latitude: v.number(),
    longitude: v.number(),
    confidence: v.optional(v.number()),
    wasteCategory: wasteCategoryValidator,
    addressLabel: v.optional(v.string()),
    landmarkNote: v.optional(v.string()),
    localAuthority: v.optional(v.string()),
    caption: v.optional(v.string()),
    reporterContact: v.optional(v.string()),
    userId: v.optional(v.string()),
    userName: v.optional(v.string()),
    clusterRadiusMeters: v.optional(v.number()),
  },
  returns: v.object({
    outcome: v.union(v.literal("new"), v.literal("clustered")),
    reportId: v.id("reports"),
    ticketCode: v.string(),
    reportCount: v.number(),
    distanceMeters: v.union(v.number(), v.null()),
    priority: v.union(v.literal("normal"), v.literal("high")),
    wasteCategory: wasteCategoryValidator,
    localAuthority: v.union(v.string(), v.null()),
    addressLabel: v.union(v.string(), v.null()),
    status: reportStatusValidator,
  }),
  handler: async (ctx, args) => {
    const radius = args.clusterRadiusMeters ?? 20;
    const now = Date.now();

    const [pendingReports, inProgressReports] = await Promise.all([
      ctx.db
        .query("reports")
        .withIndex("by_status", (q) => q.eq("status", "pending"))
        .collect(),
      ctx.db
        .query("reports")
        .withIndex("by_status", (q) => q.eq("status", "in_progress"))
        .collect(),
    ]);

    const activeReports = [...pendingReports, ...inProgressReports];

    let closestReport: (typeof activeReports)[number] | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of activeReports) {
      const dist = haversineDistanceMeters(
        args.latitude,
        args.longitude,
        candidate.latitude,
        candidate.longitude
      );
      if (dist <= radius && dist < closestDistance) {
        closestDistance = dist;
        closestReport = candidate;
      }
    }

    // Helper to allocate a collision-free #CLEO-XXXX ticket code
    const generateNextTicketCode = async (): Promise<string> => {
      const recent = await ctx.db.query("reports").order("desc").take(200);
      let maxNum = 1000;
      for (const r of recent) {
        if (r.ticketCode) {
          const match = /CLEO-(\d+)/i.exec(r.ticketCode);
          if (match) {
            const parsed = Number.parseInt(match[1], 10);
            if (!Number.isNaN(parsed) && parsed > maxNum) {
              maxNum = parsed;
            }
          }
        }
      }
      let nextNum = Math.max(maxNum + 1, 1001 + recent.length);
      for (let attempt = 0; attempt < 25; attempt++) {
        const candidateCode = `CLEO-${nextNum + attempt}`;
        const existing = await ctx.db
          .query("reports")
          .withIndex("by_ticketCode", (q) => q.eq("ticketCode", candidateCode))
          .first();
        if (!existing) {
          return candidateCode;
        }
      }
      return `CLEO-${Math.floor(1000 + (now % 9000))}`;
    };

    if (closestReport) {
      const ticketCode =
        closestReport.ticketCode ?? (await generateNextTicketCode());
      const nextCount = (closestReport.reportCount ?? 1) + 1;
      const existingPhotos: Id<"_storage">[] =
        closestReport.mergedPhotoStorageIds &&
        closestReport.mergedPhotoStorageIds.length > 0
          ? [...closestReport.mergedPhotoStorageIds]
          : [closestReport.photoStorageId];
      existingPhotos.push(args.photoStorageId);

      const existingContacts: string[] = [
        ...(closestReport.mergedReporterContacts ??
          (closestReport.reporterContact
            ? [closestReport.reporterContact]
            : [])),
      ];
      const trimmedContact = args.reporterContact?.trim();
      if (trimmedContact && !existingContacts.includes(trimmedContact)) {
        existingContacts.push(trimmedContact);
      }

      const resolvedCategory = closestReport.wasteCategory ?? args.wasteCategory;
      const resolvedAuthority =
        closestReport.localAuthority ?? args.localAuthority;
      const resolvedAddress = closestReport.addressLabel ?? args.addressLabel;

      await ctx.db.patch(closestReport._id, {
        ticketCode,
        priority: "high",
        reportCount: nextCount,
        clusterRadiusMeters: radius,
        mergedPhotoStorageIds: existingPhotos,
        mergedReporterContacts: existingContacts,
        wasteCategory: resolvedCategory,
        localAuthority: resolvedAuthority,
        addressLabel: resolvedAddress,
        landmarkNote: closestReport.landmarkNote ?? args.landmarkNote,
        escalatedAt: closestReport.escalatedAt ?? now,
      });

      return {
        outcome: "clustered" as const,
        reportId: closestReport._id,
        ticketCode,
        reportCount: nextCount,
        distanceMeters: Number(closestDistance.toFixed(1)),
        priority: "high" as const,
        wasteCategory: resolvedCategory,
        localAuthority: resolvedAuthority ?? null,
        addressLabel: resolvedAddress ?? null,
        status: closestReport.status,
      };
    }

    const ticketCode = await generateNextTicketCode();
    const trimmedContact = args.reporterContact?.trim() || undefined;
    const trimmedCaption =
      args.caption?.trim() ||
      args.landmarkNote?.trim() ||
      (args.addressLabel
        ? `Roadside litter at ${args.addressLabel}`
        : "Citizen crowdsource litter report");

    const reportId = await ctx.db.insert("reports", {
      userId: args.userId ?? "citizen-web-anon",
      userName: args.userName ?? "Citizen Reporter",
      chatId: "citizen-web",
      photoStorageId: args.photoStorageId,
      latitude: args.latitude,
      longitude: args.longitude,
      confidence: args.confidence,
      status: "pending",
      caption: trimmedCaption,
      createdAt: now,
      ticketCode,
      wasteCategory: args.wasteCategory,
      priority: "normal",
      reportCount: 1,
      clusterRadiusMeters: radius,
      mergedPhotoStorageIds: [args.photoStorageId],
      mergedReporterContacts: trimmedContact ? [trimmedContact] : [],
      addressLabel: args.addressLabel?.trim() || undefined,
      landmarkNote: args.landmarkNote?.trim() || undefined,
      localAuthority: args.localAuthority?.trim() || undefined,
      reporterContact: trimmedContact,
      source: "citizen_web",
    });

    return {
      outcome: "new" as const,
      reportId,
      ticketCode,
      reportCount: 1,
      distanceMeters: null,
      priority: "normal" as const,
      wasteCategory: args.wasteCategory,
      localAuthority: args.localAuthority ?? null,
      addressLabel: args.addressLabel ?? null,
      status: "pending" as const,
    };
  },
});

/**
 * Looks up a single report by human-readable ticket code (e.g. "#CLEO-1038") or Convex document ID.
 */
export const getReportByTicketOrId = query({
  args: { lookup: v.string() },
  returns: v.union(v.null(), citizenReportReturnValidator),
  handler: async (ctx, args) => {
    const raw = args.lookup.trim();
    if (!raw) return null;

    const normalizedCode = normalizeTicketCode(raw);
    let doc = await ctx.db
      .query("reports")
      .withIndex("by_ticketCode", (q) => q.eq("ticketCode", normalizedCode))
      .first();

    if (!doc) {
      const normalizedId = ctx.db.normalizeId("reports", raw);
      if (normalizedId) {
        doc = await ctx.db.get(normalizedId);
      }
    }

    if (!doc) {
      // Fallback: match last 4-8 chars of _id or substring of ticketCode
      const recent = await ctx.db.query("reports").order("desc").take(100);
      const lower = raw.toLowerCase().replace(/^#/, "");
      doc =
        recent.find(
          (r) =>
            r.ticketCode?.toLowerCase() === lower ||
            r._id.toLowerCase().endsWith(lower)
        ) ?? null;
    }

    if (!doc) return null;

    const imageUrl = await ctx.storage.getUrl(doc.photoStorageId);
    const proofImageUrl = doc.proofPhotoStorageId
      ? await ctx.storage.getUrl(doc.proofPhotoStorageId)
      : null;

    const mergedIds = doc.mergedPhotoStorageIds ?? [];
    const mergedUrlsRaw = await Promise.all(
      mergedIds.map((id) => ctx.storage.getUrl(id))
    );
    const mergedImageUrls = mergedUrlsRaw.filter(
      (u): u is string => typeof u === "string" && u.length > 0
    );

    return {
      ...doc,
      imageUrl,
      proofImageUrl,
      mergedImageUrls,
    };
  },
});

/**
 * Lists recent reports for the citizen portal sidebar/drawer & search bar.
 */
export const listCitizenReports = query({
  args: {
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(citizenReportReturnValidator),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    const reports = await ctx.db
      .query("reports")
      .order("desc")
      .take(Math.max(limit * 3, 60));

    const term = args.search?.trim().toLowerCase() ?? "";
    const filtered = term
      ? reports.filter((r) => {
          const hay = [
            r.ticketCode,
            r._id,
            r.addressLabel,
            r.landmarkNote,
            r.localAuthority,
            r.caption,
            r.wasteCategory,
            r.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return hay.includes(term.replace(/^#/, ""));
        })
      : reports;

    const sliced = filtered.slice(0, limit);

    return await Promise.all(
      sliced.map(async (r) => {
        const imageUrl = await ctx.storage.getUrl(r.photoStorageId);
        const proofImageUrl = r.proofPhotoStorageId
          ? await ctx.storage.getUrl(r.proofPhotoStorageId)
          : null;
        return {
          ...r,
          imageUrl,
          proofImageUrl,
          mergedImageUrls: imageUrl ? [imageUrl] : [],
        };
      })
    );
  },
});

