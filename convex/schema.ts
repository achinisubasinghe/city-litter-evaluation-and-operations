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
    // Worker resolution & proof telemetry
    proofPhotoStorageId: v.optional(v.id("_storage")),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
    resolutionNotes: v.optional(v.string()),
    // Worker assignment
    assignedWorkerId: v.optional(v.string()),
    assignedWorkerName: v.optional(v.string()),
    assignedAt: v.optional(v.number()),
    // Citizen crowdsource & 20m spatial clustering fields
    ticketCode: v.optional(v.string()),
    wasteCategory: v.optional(
      v.union(
        v.literal("plastic"),
        v.literal("organic"),
        v.literal("paper"),
        v.literal("metal"),
        v.literal("glass"),
        v.literal("bulky")
      )
    ),
    priority: v.optional(v.union(v.literal("normal"), v.literal("high"))),
    reportCount: v.optional(v.number()),
    clusterRadiusMeters: v.optional(v.number()),
    mergedPhotoStorageIds: v.optional(v.array(v.id("_storage"))),
    mergedReporterContacts: v.optional(v.array(v.string())),
    addressLabel: v.optional(v.string()),
    landmarkNote: v.optional(v.string()),
    localAuthority: v.optional(v.string()),
    reporterContact: v.optional(v.string()),
    source: v.optional(
      v.union(
        v.literal("citizen_web"),
        v.literal("telegram_bot"),
        v.literal("whatsapp_bot"),
        v.literal("edge_unit")
      )
    ),
    escalatedAt: v.optional(v.number()),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_assignedWorkerId", ["assignedWorkerId"])
    .index("by_ticketCode", ["ticketCode"]),

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
