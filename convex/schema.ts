import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  reports: defineTable({
    userId: v.string(),
    userName: v.optional(v.string()),
    chatId: v.string(),
    photoStorageId: v.id("_storage"),
    latitude: v.number(),
    longitude: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("rejected")
    ),
    caption: v.optional(v.string()),
    confidence: v.optional(v.number()), // Detection confidence (0.0 - 1.0)
    createdAt: v.number(),
    // GPS + IMU Accelerometer location correction telemetry
    rawLatitude: v.optional(v.number()),
    rawLongitude: v.optional(v.number()),
    isLocationCorrected: v.optional(v.boolean()),
    correctionMethod: v.optional(v.string()),
    speedKmh: v.optional(v.number()),
    heading: v.optional(v.number()),
    offsetMeters: v.optional(v.number()),
    // Camera quality metrics
    qualityScore: v.optional(v.number()),
    blurScore: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"]),

  drafts: defineTable({
    userId: v.string(),
    chatId: v.string(),
    userName: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    caption: v.optional(v.string()),
    confidence: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),
});
