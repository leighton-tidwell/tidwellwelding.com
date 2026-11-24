import rateLimiterComponent from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

function setup() {
  const t = convexTest(schema, modules);
  rateLimiterComponent.register(t);
  return t;
}

const PASSWORD = "a-long-enough-password";

async function signedIn(t: ReturnType<typeof setup>) {
  const userId = await t.mutation(internal.auth.createAdminUser, {
    email: "eric@tidwellwelding.com",
  });
  const setupToken = await t.mutation(internal.auth.issueSetupToken, {
    userId,
  });
  await t.mutation(api.auth.setPassword, {
    token: setupToken,
    password: PASSWORD,
  });
  const result = await t.mutation(api.auth.login, {
    email: "eric@tidwellwelding.com",
    password: PASSWORD,
  });
  if (!result.ok || !result.token) throw new Error("login failed in setup");
  return result.token;
}

/** Customers and an invoice written the way production holds them today:
 * straight rows, with no business behind them. */
async function legacyRows(t: ReturnType<typeof setup>) {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const company = await ctx.db.insert("customers", {
      name: "Dale Bishop",
      company: "Bishop Fabrication LLC",
      phone: "8175550142",
      email: "dale@bishopfab.test",
      address: "1400 Industrial Blvd, Granbury, TX 76048",
      createdAt: now,
      updatedAt: now,
    });
    const person = await ctx.db.insert("customers", {
      name: "Tom Keller",
      phone: "8175550110",
      createdAt: now,
      updatedAt: now,
    });
    const bare = await ctx.db.insert("customers", {
      name: "Walk-in",
      createdAt: now,
      updatedAt: now,
    });
    const invoice = await ctx.db.insert("invoices", {
      number: "TSWS-010126",
      status: "sent",
      customerId: company,
      issuedAt: now,
      terms: "Due upon receipt",
      lineItems: [
        {
          qty: 2,
          unit: "hr",
          description: "Bucket ear repair",
          rateCents: 9500,
          taxable: false,
        },
      ],
      discountCents: 0,
      taxRateBasisPoints: 0,
      paymentsCents: 0,
      createdAt: now,
      updatedAt: now,
    });
    const slip = await ctx.db.insert("packingSlips", {
      number: "PS-010126",
      customerId: company,
      invoiceId: invoice,
      shipToName: "Bishop Fabrication LLC",
      shippedAt: now,
      lineItems: [],
      createdAt: now,
      updatedAt: now,
    });
    return { company, person, bare, invoice, slip };
  });
}

async function backfillAll(t: ReturnType<typeof setup>) {
  let cursor: string | null = null;
  let created = 0;
  for (;;) {
    const page: {
      created: number;
      isDone: boolean;
      continueCursor: string;
    } = await t.mutation(internal.businesses.backfillFromCustomers, {
      paginationOpts: { numItems: 2, cursor },
    });
    created += page.created;
    if (page.isDone) return created;
    cursor = page.continueCursor;
  }
}

async function businessFor(
  t: ReturnType<typeof setup>,
  customerId: Id<"customers">,
) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("businesses")
      .withIndex("by_customer", (q) => q.eq("customerId", customerId))
      .unique(),
  );
}

describe("customer backfill", () => {
  test("each customer becomes a business with its contact as primary", async () => {
    const t = setup();
    const rows = await legacyRows(t);

    expect(await backfillAll(t)).toBe(3);

    const bishop = await businessFor(t, rows.company);
    expect(bishop?.name).toBe("Bishop Fabrication LLC");
    expect(bishop?.address).toBe("1400 Industrial Blvd, Granbury, TX 76048");
    const primary = await t.run(async (ctx) =>
      bishop?.primaryContactId ? ctx.db.get(bishop.primaryContactId) : null,
    );
    expect(primary).toMatchObject({
      name: "Dale Bishop",
      email: "dale@bishopfab.test",
      phone: "8175550142",
      active: true,
    });

    // A person billed directly is their own business and contact.
    const keller = await businessFor(t, rows.person);
    expect(keller?.name).toBe("Tom Keller");
    expect(keller?.primaryContactId).toBeDefined();

    // Nobody to reach means no contact is invented.
    const bare = await businessFor(t, rows.bare);
    expect(bare?.name).toBe("Walk-in");
    expect(bare?.primaryContactId).toBeUndefined();
  });

  test("re-running the backfill makes nothing twice", async () => {
    const t = setup();
    await legacyRows(t);
    await backfillAll(t);

    expect(await backfillAll(t)).toBe(0);
    const counts = await t.run(async (ctx) => ({
      businesses: (await ctx.db.query("businesses").collect()).length,
      contacts: (await ctx.db.query("contacts").collect()).length,
    }));
    expect(counts).toEqual({ businesses: 3, contacts: 2 });
  });

  test("existing invoices resolve the same bill-to after the backfill", async () => {
    const t = setup();
    const token = await signedIn(t);
    const rows = await legacyRows(t);
    const before = await t.query(internal.invoicePdfData.loadForPdf, {
      token,
      id: rows.invoice,
    });

    await backfillAll(t);

    const after = await t.query(internal.invoicePdfData.loadForPdf, {
      token,
      id: rows.invoice,
    });
    expect(after.input).toEqual(before.input);

    const bishop = await businessFor(t, rows.company);
    if (!bishop) throw new Error("no business");
    const page = await t.query(api.businesses.get, { token, id: bishop._id });
    expect(page?.invoices.map((i) => i.number)).toEqual(["TSWS-010126"]);
    expect(page?.invoices[0]?.amounts?.totalCents).toBe(19000);
    expect(page?.packingSlips.map((s) => s.number)).toEqual(["PS-010126"]);
    expect(page?.billedCents).toBe(19000);
  });
});

test("editing a backfilled business leaves its invoice bill-to alone", async () => {
  const t = setup();
  const token = await signedIn(t);
  const rows = await legacyRows(t);
  const before = await t.query(internal.invoicePdfData.loadForPdf, {
    token,
    id: rows.invoice,
  });
  await backfillAll(t);
  const bishop = await businessFor(t, rows.company);
  if (!bishop) throw new Error("no business");

  // Dale was read as the primary but never had a CONTACT line of his own.
  await t.mutation(api.businesses.update, {
    token,
    id: bishop._id,
    notes: "Net 30 since 2025",
  });

  const after = await t.query(internal.invoicePdfData.loadForPdf, {
    token,
    id: rows.invoice,
  });
  expect(after.input.customer).toEqual(before.input.customer);
});

describe("primary contact", () => {
  async function bishopBusiness(t: ReturnType<typeof setup>) {
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Dale Bishop",
      company: "Bishop Fabrication LLC",
      phone: "8175550142",
    });
    const businessId = await t.query(api.businesses.forCustomer, {
      token,
      customerId,
    });
    if (!businessId) throw new Error("customer saved without a business");
    return { token, customerId, businessId };
  }

  test("changing it writes history with who changed it", async () => {
    const t = setup();
    const { token, businessId } = await bishopBusiness(t);
    const rosa = await t.mutation(api.businesses.addContact, {
      token,
      businessId,
      name: "Rosa Martinez",
      title: "Purchasing",
      email: "rosa@bishopfab.test",
    });

    await t.mutation(api.businesses.setPrimaryContact, {
      token,
      businessId,
      contactId: rosa,
    });
    // A repeat click is not a second change.
    await t.mutation(api.businesses.setPrimaryContact, {
      token,
      businessId,
      contactId: rosa,
    });

    const page = await t.query(api.businesses.get, { token, id: businessId });
    expect(page?.business.primaryContactId).toBe(rosa);
    expect(
      page?.history.map(({ from, to, changedBy }) => ({ from, to, changedBy })),
    ).toEqual([
      {
        from: "Dale Bishop",
        to: "Rosa Martinez",
        changedBy: "eric@tidwellwelding.com",
      },
      { from: null, to: "Dale Bishop", changedBy: "eric@tidwellwelding.com" },
    ]);
  });

  test("the new primary reaches the invoice bill-to", async () => {
    const t = setup();
    const { token, customerId, businessId } = await bishopBusiness(t);
    const rosa = await t.mutation(api.businesses.addContact, {
      token,
      businessId,
      name: "Rosa Martinez",
      phone: "2545550187",
      makePrimary: true,
    });
    const invoiceId = await t.mutation(api.invoices.create, {
      token,
      customerId,
    });

    const { input } = await t.query(internal.invoicePdfData.loadForPdf, {
      token,
      id: invoiceId,
    });
    expect(input.customer).toMatchObject({
      company: "Bishop Fabrication LLC",
      contact: "Rosa Martinez",
      phone: "2545550187",
    });

    await t.mutation(api.businesses.updateContact, {
      token,
      id: rosa,
      phone: "2545550100",
    });
    const again = await t.query(internal.invoicePdfData.loadForPdf, {
      token,
      id: invoiceId,
    });
    expect(again.input.customer.phone).toBe("2545550100");
  });

  test("the primary contact cannot be deactivated", async () => {
    const t = setup();
    const { token, businessId } = await bishopBusiness(t);
    const page = await t.query(api.businesses.get, { token, id: businessId });
    const dale = page?.business.primaryContactId;
    if (!dale) throw new Error("no primary");

    await expect(
      t.mutation(api.businesses.setContactActive, {
        token,
        id: dale,
        active: false,
      }),
    ).rejects.toThrow("Make someone else primary");
  });

  test("an inactive contact cannot be made primary", async () => {
    const t = setup();
    const { token, businessId } = await bishopBusiness(t);
    const rosa = await t.mutation(api.businesses.addContact, {
      token,
      businessId,
      name: "Rosa Martinez",
    });
    await t.mutation(api.businesses.setContactActive, {
      token,
      id: rosa,
      active: false,
    });

    await expect(
      t.mutation(api.businesses.setPrimaryContact, {
        token,
        businessId,
        contactId: rosa,
      }),
    ).rejects.toThrow("Reactivate");
  });

  test("editing the customer row updates the primary contact", async () => {
    const t = setup();
    const { token, customerId, businessId } = await bishopBusiness(t);

    await t.mutation(api.customers.update, {
      token,
      id: customerId,
      email: "dale@bishopfab.test",
      company: "Bishop Fab",
    });

    const page = await t.query(api.businesses.get, { token, id: businessId });
    expect(page?.business.name).toBe("Bishop Fab");
    const primary = page?.contacts.find(
      (c) => c._id === page.business.primaryContactId,
    );
    expect(primary).toMatchObject({
      name: "Dale Bishop",
      email: "dale@bishopfab.test",
    });
  });

  test("renaming the person on the customer row renames the primary they became", async () => {
    const t = setup();
    const { token, customerId, businessId } = await bishopBusiness(t);

    await t.mutation(api.customers.update, {
      token,
      id: customerId,
      name: "Dale R. Bishop",
    });

    const page = await t.query(api.businesses.get, { token, id: businessId });
    const primary = page?.contacts.find(
      (c) => c._id === page.business.primaryContactId,
    );
    expect(primary?.name).toBe("Dale R. Bishop");
  });

  test("business calls need a signed-in session", async () => {
    const t = setup();
    await expect(
      t.query(api.businesses.list, { token: "not-a-session" }),
    ).rejects.toThrow("Not signed in");
  });
});
