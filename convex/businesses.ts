import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  type MutationCtx,
  mutation,
  query,
} from "./_generated/server";
import { requireAdmin } from "./auth";
import {
  businessForCustomer,
  ensureBusinessForCustomer,
  optionalText,
  recordPrimaryChange,
  requireText,
  writeThroughToCustomer,
} from "./lib/businesses";
import { invoiceAmountsFor } from "./lib/financials";

/**
 * Businesses and the people at them. Every function here still checks the
 * single admin session; each carries the permission PR 1's requireAccess will
 * check instead.
 */

async function loadBusiness(
  ctx: MutationCtx,
  id: Id<"businesses">,
): Promise<Doc<"businesses">> {
  const business = await ctx.db.get(id);
  if (!business) throw new Error("That business no longer exists");
  return business;
}

async function loadContact(
  ctx: MutationCtx,
  id: Id<"contacts">,
): Promise<Doc<"contacts">> {
  const contact = await ctx.db.get(id);
  if (!contact) throw new Error("That contact no longer exists");
  return contact;
}

/** Point a business at a new primary contact and log the change. A no-op when
 * it already is the primary, so a double-click writes one history row. */
async function setPrimary(
  ctx: MutationCtx,
  business: Doc<"businesses">,
  contactId: Id<"contacts">,
  changedBy: Id<"adminUsers">,
) {
  if (business.primaryContactId === contactId) return;
  await recordPrimaryChange(
    ctx,
    business._id,
    business.primaryContactId,
    contactId,
    changedBy,
  );
  const updated = { ...business, primaryContactId: contactId };
  await ctx.db.patch(business._id, {
    primaryContactId: contactId,
    updatedAt: Date.now(),
  });
  await writeThroughToCustomer(ctx, updated);
}

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // TODO(rbac): businesses.read
    await requireAdmin(ctx, args.token);
    const businesses = await ctx.db
      .query("businesses")
      .withIndex("by_name")
      .collect();
    const rows = [];
    for (const business of businesses) {
      const primary = business.primaryContactId
        ? await ctx.db.get(business.primaryContactId)
        : null;
      rows.push({ ...business, primaryContactName: primary?.name ?? null });
    }
    return rows;
  },
});

/** The business behind a customer row, for screens still keyed by customer.
 * Null until the backfill (or ensureForCustomer) has made one. */
export const forCustomer = query({
  args: { token: v.string(), customerId: v.id("customers") },
  handler: async (ctx, args) => {
    // TODO(rbac): businesses.read
    await requireAdmin(ctx, args.token);
    const business = await businessForCustomer(ctx, args.customerId);
    return business?._id ?? null;
  },
});

/** Everything the business page shows, in one read. */
export const get = query({
  args: { token: v.string(), id: v.id("businesses") },
  handler: async (ctx, args) => {
    // TODO(rbac): businesses.read
    const userId = await requireAdmin(ctx, args.token);
    const business = await ctx.db.get(args.id);
    if (!business) return null;

    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    const nameOf = (id: Id<"contacts"> | undefined) =>
      id ? (contacts.find((c) => c._id === id)?.name ?? null) : null;

    const historyRows = await ctx.db
      .query("contactHistory")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .order("desc")
      .collect();
    const history = [];
    for (const row of historyRows) {
      const by = row.changedBy ? await ctx.db.get(row.changedBy) : null;
      history.push({
        _id: row._id,
        subjectType: row.subjectType,
        changedAt: row.changedAt,
        from: nameOf(row.fromContactId),
        to: nameOf(row.toContactId),
        changedBy: by?.email ?? null,
      });
    }

    const invoiceDocs = await ctx.db
      .query("invoices")
      .withIndex("by_customer", (q) => q.eq("customerId", business.customerId))
      .order("desc")
      .collect();
    const invoices = [];
    for (const invoice of invoiceDocs) {
      invoices.push({
        _id: invoice._id,
        number: invoice.number,
        status: invoice.status,
        issuedAt: invoice.issuedAt,
        // TODO(rbac): financials.read is decided inside the helper.
        amounts: await invoiceAmountsFor(ctx, userId, invoice),
      });
    }

    const slips = await ctx.db
      .query("packingSlips")
      .withIndex("by_customer", (q) => q.eq("customerId", business.customerId))
      .order("desc")
      .collect();

    return {
      business,
      contacts,
      history,
      invoices,
      packingSlips: slips.map((slip) => ({
        _id: slip._id,
        number: slip.number,
        shippedAt: slip.shippedAt,
        invoiced: slip.invoiceId !== undefined,
      })),
    };
  },
});

/** Make the business for a customer the backfill has not reached yet. */
export const ensureForCustomer = mutation({
  args: { token: v.string(), customerId: v.id("customers") },
  handler: async (ctx, args) => {
    // TODO(rbac): businesses.write
    const userId = await requireAdmin(ctx, args.token);
    const customer = await ctx.db.get(args.customerId);
    if (!customer) throw new Error("That customer no longer exists");
    return (await ensureBusinessForCustomer(ctx, customer, userId)).id;
  },
});

export const update = mutation({
  args: {
    token: v.string(),
    id: v.id("businesses"),
    name: v.optional(v.string()),
    address: v.optional(v.string()),
    notes: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    // TODO(rbac): businesses.write
    await requireAdmin(ctx, token);
    const business = await loadBusiness(ctx, id);
    const patch: Partial<Doc<"businesses">> = { updatedAt: Date.now() };
    if (fields.name !== undefined)
      patch.name = requireText(fields.name, "business name");
    if (fields.address !== undefined)
      patch.address = optionalText(fields.address);
    if (fields.notes !== undefined) patch.notes = optionalText(fields.notes);
    if (fields.status !== undefined) patch.status = fields.status;
    await ctx.db.patch(id, patch);
    await writeThroughToCustomer(ctx, { ...business, ...patch });
  },
});

export const addContact = mutation({
  args: {
    token: v.string(),
    businessId: v.id("businesses"),
    name: v.string(),
    title: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    makePrimary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // TODO(rbac): businesses.write
    const userId = await requireAdmin(ctx, args.token);
    const business = await loadBusiness(ctx, args.businessId);
    const now = Date.now();
    const contactId = await ctx.db.insert("contacts", {
      businessId: business._id,
      name: requireText(args.name, "contact name"),
      title: optionalText(args.title),
      email: optionalText(args.email),
      phone: optionalText(args.phone),
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    // A business with nobody on file takes its first contact as primary.
    if (args.makePrimary || business.primaryContactId === undefined) {
      await setPrimary(ctx, business, contactId, userId);
    }
    return contactId;
  },
});

export const updateContact = mutation({
  args: {
    token: v.string(),
    id: v.id("contacts"),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, { token, id, ...fields }) => {
    // TODO(rbac): businesses.write
    await requireAdmin(ctx, token);
    const contact = await loadContact(ctx, id);
    const patch: Partial<Doc<"contacts">> = { updatedAt: Date.now() };
    if (fields.name !== undefined)
      patch.name = requireText(fields.name, "contact name");
    for (const key of ["title", "email", "phone"] as const) {
      if (fields[key] !== undefined) patch[key] = optionalText(fields[key]);
    }
    await ctx.db.patch(id, patch);
    const business = await loadBusiness(ctx, contact.businessId);
    if (business.primaryContactId === id) {
      await writeThroughToCustomer(ctx, business);
    }
  },
});

export const setContactActive = mutation({
  args: { token: v.string(), id: v.id("contacts"), active: v.boolean() },
  handler: async (ctx, args) => {
    // TODO(rbac): businesses.write
    await requireAdmin(ctx, args.token);
    const contact = await loadContact(ctx, args.id);
    if (!args.active) {
      const business = await loadBusiness(ctx, contact.businessId);
      if (business.primaryContactId === contact._id) {
        throw new Error("Make someone else primary before deactivating");
      }
    }
    await ctx.db.patch(args.id, {
      active: args.active,
      updatedAt: Date.now(),
    });
  },
});

export const setPrimaryContact = mutation({
  args: {
    token: v.string(),
    businessId: v.id("businesses"),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    // TODO(rbac): businesses.write
    const userId = await requireAdmin(ctx, args.token);
    const business = await loadBusiness(ctx, args.businessId);
    const contact = await loadContact(ctx, args.contactId);
    if (contact.businessId !== business._id) {
      throw new Error("That contact belongs to another business");
    }
    if (!contact.active) {
      throw new Error("Reactivate that contact before making them primary");
    }
    await setPrimary(ctx, business, contact._id, userId);
  },
});

/**
 * One-off migration: give every customer a business, with its contact, email
 * and phone as the primary contact. Reads customers only, so every invoice and
 * packing slip keeps resolving its bill-to exactly as before. Idempotent and
 * paged; run until isDone:
 *   npx convex run businesses:backfillFromCustomers '{"paginationOpts":{"numItems":100,"cursor":null}}'
 */
export const backfillFromCustomers = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const page = await ctx.db.query("customers").paginate(paginationOpts);
    let created = 0;
    for (const customer of page.page) {
      if ((await ensureBusinessForCustomer(ctx, customer)).created) created++;
    }
    return {
      created,
      scanned: page.page.length,
      isDone: page.isDone,
      continueCursor: page.continueCursor,
    };
  },
});
