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
  // the database, never in code, so the admin console can edit it without a
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

  // --- Admin console -------------------------------------------------------
  // One operator account, created server-side. There is deliberately no public
  // registration path anywhere in the API.
  adminUsers: defineTable({
    email: v.string(),
    passwordHash: v.optional(v.string()),
    passwordSalt: v.optional(v.string()),
    // Set the first time a password is chosen. Its presence permanently blocks
    // the public set-password route, even if a token were somehow replayed.
    passwordSetAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // One-time set-password links. Only the hash is stored, so reading the table
  // does not yield a usable link. Burned by stamping usedAt.
  setupTokens: defineTable({
    tokenHash: v.string(),
    userId: v.id("adminUsers"),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_tokenHash", ["tokenHash"]),

  adminSessions: defineTable({
    token: v.string(),
    userId: v.id("adminUsers"),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_token", ["token"])
    .index("by_user", ["userId"]),

  // Saved customers so Eric never retypes billing details.
  customers: defineTable({
    name: v.string(),
    company: v.optional(v.string()),
    contact: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  // Money is integer cents throughout. Totals are always recomputed from the
  // line items server-side; a client-supplied total is never trusted.
  invoices: defineTable({
    number: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("void"),
    ),
    customerId: v.id("customers"),
    jobPo: v.optional(v.string()),
    issuedAt: v.number(),
    dueAt: v.optional(v.number()),
    terms: v.string(),
    lineItems: v.array(
      v.object({
        qty: v.number(),
        unit: v.union(
          v.literal("hr"),
          v.literal("ea"),
          v.literal("ft"),
          v.literal("lb"),
          v.literal("lot"),
        ),
        description: v.string(),
        rateCents: v.number(),
        taxable: v.boolean(),
      }),
    ),
    discountCents: v.number(),
    taxRateBasisPoints: v.number(),
    paymentsCents: v.number(),
    notes: v.optional(v.string()),
    /** Last generated PDF. Replaced on every regeneration so downloads never
     * serve a stale file and old blobs do not accumulate. */
    pdfStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_number", ["number"])
    .index("by_status", ["status", "createdAt"])
    .index("by_customer", ["customerId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),
});
