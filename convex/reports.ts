import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";

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
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const reports = await ctx.db.query("reports").order("desc").take(limit);

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

/**
 * Ingestion mutation specifically for edge hardware units (Raspberry Pi prototype).
 * Inserts the detection directly with offline timestamps and GPS coordinates.
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
  },
  returns: v.object({
    reportId: v.id("reports"),
    status: v.literal("created"),
  }),
  handler: async (ctx, args) => {
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

