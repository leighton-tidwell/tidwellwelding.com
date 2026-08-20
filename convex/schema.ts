import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  quotes: defineTable({
    requestId: v.string(),
    name: v.string(),
    company: v.optional(v.string()),
    phone: v.string(),
    email: v.optional(v.string()),
    job: v.object({
      type: v.string(),
      material: v.optional(v.string()),
      desc: v.string(),
      dims: v.optional(v.string()),
      timeline: v.optional(v.string()),
      location: v.optional(v.string()),
      compQuote: v.optional(v.string()),
      photoNames: v.optional(v.array(v.string())),
    }),
    // AI draft estimate JSON (validated loosely; shape enforced at read time).
    estimate: v.optional(v.any()),
    slot: v.string(),
    status: v.string(),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status", "createdAt"])
    .index("by_requestId", ["requestId"]),

  contactMessages: defineTable({
    name: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    subject: v.optional(v.string()),
    message: v.string(),
    createdAt: v.number(),
  }).index("by_createdAt", ["createdAt"]),

  chatThreads: defineTable({
    sessionId: v.string(),
    createdAt: v.number(),
    messageCount: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  chatMessages: defineTable({
    threadId: v.id("chatThreads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
    contact: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_thread", ["threadId"]),

  // Sessions that passed a Turnstile check recently. Lets submitQuote accept a
  // recently verified session without a second token.
  verifiedSessions: defineTable({
    sessionId: v.string(),
    expiresAt: v.number(),
  }).index("by_sessionId", ["sessionId"]),

  // Researched material-price snapshot injected into estimator prompts. One
  // web-search-enabled refresh per day (lazy), never one per quote.
  marketSnapshots: defineTable({
    content: v.string(),
    createdAt: v.number(),
    refreshRequestedAt: v.optional(v.number()),
  }).index("by_createdAt", ["createdAt"]),

  // Operator-editable shop settings (labor rate today, more later). Lives in
  // the database, never in code, so the crew console can edit it without a
  // deploy. Values are confidential and never leave the server.
  shopSettings: defineTable({
    key: v.string(),
    numberValue: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  // Full AI drafts (including dollars the customer may not have been shown on
  // low confidence) so the owner email always carries the numbers.
  estimateDrafts: defineTable({
    sessionId: v.string(),
    estimate: v.any(),
    createdAt: v.number(),
  }).index("by_sessionId", ["sessionId", "createdAt"]),
});
