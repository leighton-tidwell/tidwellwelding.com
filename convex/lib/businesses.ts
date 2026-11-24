import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * The bridge between the legacy `customers` table and businesses/contacts.
 *
 * A customer row stays the bill-to record that invoices, packing slips and
 * their PDFs read. A business wraps it one to one. Writes in either direction
 * go through here so the two never drift: the Customers screen and the quote
 * inbox still write customers, and the business page still feeds the PDFs.
 */

export function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed === "" ? undefined : trimmed;
}

export function requireText(value: string, label: string): string {
  const trimmed = value.trim();
  if (trimmed === "") throw new Error(`A ${label} is required`);
  return trimmed;
}

/**
 * How a customer row reads as a business. Rows with a company are a company
 * whose `name` is the person; rows without one are a person billed directly,
 * so the person is both the business and its contact.
 */
export function businessFieldsFrom(customer: Doc<"customers">) {
  const hasReachableContact =
    customer.contact !== undefined ||
    customer.email !== undefined ||
    customer.phone !== undefined ||
    customer.company !== undefined;
  return {
    name: customer.company ?? customer.name,
    address: customer.address,
    notes: customer.notes,
    primary: hasReachableContact
      ? {
          name: customer.contact ?? customer.name,
          email: customer.email,
          phone: customer.phone,
        }
      : null,
  };
}

export async function businessForCustomer(
  ctx: { db: QueryCtx["db"] },
  customerId: Id<"customers">,
): Promise<Doc<"businesses"> | null> {
  return await ctx.db
    .query("businesses")
    .withIndex("by_customer", (q) => q.eq("customerId", customerId))
    .unique();
}

/**
 * Create the business for a customer if it has none. Idempotent, so the
 * backfill can be re-run and a customer saved twice never gets two. Only
 * reads the customer: the backfill must leave every bill-to exactly as it was.
 */
export async function ensureBusinessForCustomer(
  ctx: MutationCtx,
  customer: Doc<"customers">,
  changedBy?: Id<"adminUsers">,
): Promise<{ id: Id<"businesses">; created: boolean }> {
  const existing = await businessForCustomer(ctx, customer._id);
  if (existing) return { id: existing._id, created: false };

  const fields = businessFieldsFrom(customer);
  const now = Date.now();
  const businessId = await ctx.db.insert("businesses", {
    name: fields.name,
    address: fields.address,
    notes: fields.notes,
    status: "active",
    customerId: customer._id,
    createdAt: now,
    updatedAt: now,
  });
  if (fields.primary) {
    const contactId = await ctx.db.insert("contacts", {
      businessId,
      ...fields.primary,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await recordPrimaryChange(ctx, businessId, undefined, contactId, changedBy);
    await ctx.db.patch(businessId, { primaryContactId: contactId });
  }
  return { id: businessId, created: true };
}

export async function recordPrimaryChange(
  ctx: MutationCtx,
  businessId: Id<"businesses">,
  fromContactId: Id<"contacts"> | undefined,
  toContactId: Id<"contacts"> | undefined,
  changedBy: Id<"adminUsers"> | undefined,
) {
  await ctx.db.insert("contactHistory", {
    subjectType: "business",
    businessId,
    fromContactId,
    toContactId,
    changedBy,
    changedAt: Date.now(),
  });
}

/**
 * Write a business's name, address and primary contact down to its customer
 * row, so the next invoice or packing slip PDF shows what the business page
 * shows. The name goes where the customer kept it: `company` when it had one.
 */
export async function writeThroughToCustomer(
  ctx: MutationCtx,
  business: Doc<"businesses">,
) {
  const customer = await ctx.db.get(business.customerId);
  if (!customer) return;
  const primary = business.primaryContactId
    ? await ctx.db.get(business.primaryContactId)
    : null;
  await ctx.db.patch(customer._id, {
    ...(customer.company !== undefined
      ? { company: business.name }
      : { name: business.name }),
    address: business.address,
    notes: business.notes,
    contact: primary?.name,
    email: primary?.email,
    phone: primary?.phone,
    updatedAt: Date.now(),
  });
}

/**
 * The other direction: the Customers screen edited a customer row, so mirror
 * the supplied fields onto its business and primary contact. Fields that were
 * not supplied are left alone on both sides.
 */
export async function mirrorCustomerEdit(
  ctx: MutationCtx,
  customer: Doc<"customers">,
  supplied: {
    contact?: boolean;
    email?: boolean;
    phone?: boolean;
  },
  changedBy: Id<"adminUsers">,
) {
  const { id, created } = await ensureBusinessForCustomer(
    ctx,
    customer,
    changedBy,
  );
  if (created) return;
  const business = await ctx.db.get(id);
  if (!business) return;

  const fields = businessFieldsFrom(customer);
  const now = Date.now();
  await ctx.db.patch(id, {
    name: fields.name,
    address: fields.address,
    notes: fields.notes,
    updatedAt: now,
  });

  if (!supplied.contact && !supplied.email && !supplied.phone) return;
  const primary = business.primaryContactId
    ? await ctx.db.get(business.primaryContactId)
    : null;
  if (primary) {
    await ctx.db.patch(primary._id, {
      ...(supplied.contact ? { name: customer.contact ?? customer.name } : {}),
      ...(supplied.email ? { email: customer.email } : {}),
      ...(supplied.phone ? { phone: customer.phone } : {}),
      updatedAt: now,
    });
  } else if (fields.primary) {
    const contactId = await ctx.db.insert("contacts", {
      businessId: id,
      ...fields.primary,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    await recordPrimaryChange(ctx, id, undefined, contactId, changedBy);
    await ctx.db.patch(id, { primaryContactId: contactId });
  }
}

/** Remove a business with its contacts and history, for a deleted customer. */
export async function deleteBusinessForCustomer(
  ctx: MutationCtx,
  customerId: Id<"customers">,
) {
  const business = await businessForCustomer(ctx, customerId);
  if (!business) return;
  for (const table of ["contacts", "contactHistory"] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
  await ctx.db.delete(business._id);
}
