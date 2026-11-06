import rateLimiterComponent from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

/** auth.login is rate limited, so the component must be registered or every
 * sign-in in these tests throws before it reaches the credential check. */
function convexTestWithLimiter() {
  const t = convexTest(schema, modules);
  rateLimiterComponent.register(t);
  return t;
}

const PASSWORD = "a-long-enough-password";

async function signedIn(t: ReturnType<typeof convexTest>) {
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
  if (!result.ok || !result.token)
    throw new Error("login failed in test setup");
  return result.token;
}

const JOB = {
  type: "Gate / fence",
  desc: "Ranch gate, 16 ft, with a walk-through",
  material: "A36",
};

/** A full AI draft in the on-the-wire snake_case the estimator produces. */
const ESTIMATE = {
  title: "16 ft ranch gate",
  summary: "Fabricate and hang a 16 ft gate with a walk-through.",
  line_items: [{ task: "Fabricate frame", crew: 1, hours: 8 }],
  hours_low: 8,
  hours_high: 12,
  dollars_low: 1200,
  dollars_high: 1800,
  confidence: "medium" as const,
  questions: ["Is there power at the site?"],
};

async function insertQuote(
  t: ReturnType<typeof convexTest>,
  overrides: Record<string, unknown> = {},
) {
  // insertQuote returns the row id and the request id it claimed; these tests
  // address rows by id.
  const { id } = await t.mutation(internal.quotes.insertQuote, {
    requestId: "Q-2026-101",
    name: "Marisol Serrano",
    phone: "(817) 555-0142",
    job: JOB,
    slot: "Thursday morning",
    ...overrides,
  });
  return id;
}

describe("adminQuotes — authorization", () => {
  test("list refuses a caller with no session token", async () => {
    const t = convexTestWithLimiter();
    await insertQuote(t);

    await expect(t.query(api.adminQuotes.list, { token: "" })).rejects.toThrow(
      /not signed in/i,
    );
  });

  test("list refuses a made-up token", async () => {
    const t = convexTestWithLimiter();
    await insertQuote(t);

    await expect(
      t.query(api.adminQuotes.list, { token: "deadbeef".repeat(8) }),
    ).rejects.toThrow(/not signed in/i);
  });

  test("get refuses an unauthenticated caller, even with a real quote id", async () => {
    const t = convexTestWithLimiter();
    const id = await insertQuote(t);

    await expect(
      t.query(api.adminQuotes.get, { token: "nope", id }),
    ).rejects.toThrow(/not signed in/i);
  });

  test("an expired session cannot read the inbox", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    await insertQuote(t);

    // Age the session past its window rather than waiting 12 hours.
    await t.run(async (ctx) => {
      const session = await ctx.db
        .query("adminSessions")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      if (!session) throw new Error("no session row");
      await ctx.db.patch(session._id, { expiresAt: Date.now() - 1000 });
    });

    await expect(t.query(api.adminQuotes.list, { token })).rejects.toThrow(
      /not signed in/i,
    );
  });
});

describe("adminQuotes — the inbox list", () => {
  test("newest requests come first", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);

    const first = await insertQuote(t, { requestId: "Q-2026-101" });
    await insertQuote(t, { requestId: "Q-2026-102" });
    // insertQuote stamps Date.now(); force a gap so the order is not a tie.
    await t.run(async (ctx) => {
      await ctx.db.patch(first, { createdAt: Date.now() - 60_000 });
    });

    const rows = await t.query(api.adminQuotes.list, { token });
    expect(rows.map((row) => row.requestId)).toEqual([
      "Q-2026-102",
      "Q-2026-101",
    ]);
  });

  test("a row carries the contact, job type and dollar range for the list", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    await insertQuote(t, { company: "Serrano Builds", estimate: ESTIMATE });

    const row = (await t.query(api.adminQuotes.list, { token }))[0]!;
    expect(row.name).toBe("Marisol Serrano");
    expect(row.company).toBe("Serrano Builds");
    expect(row.jobType).toBe("Gate / fence");
    expect(row.dollarsLow).toBe(1200);
    expect(row.dollarsHigh).toBe(1800);
    expect(row.status).toBe("new");
  });

  test("a quote with no estimate omits the dollar range instead of showing zero", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    await insertQuote(t);

    const row = (await t.query(api.adminQuotes.list, { token }))[0]!;
    expect(row.dollarsLow).toBeUndefined();
    expect(row.dollarsHigh).toBeUndefined();
  });

  test("the file count is zero for a quote taken before uploads existed", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    await insertQuote(t, {
      job: { ...JOB, photoNames: ["gate.jpg", "post.jpg"] },
    });

    const row = (await t.query(api.adminQuotes.list, { token }))[0]!;
    expect(row.fileCount).toBe(0);
  });
});

describe("adminQuotes — one quote with its files", () => {
  test("files come back with a download URL for each upload", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["fake-jpeg-bytes"], { type: "image/jpeg" })),
    );
    const id = await insertQuote(t, {
      files: [
        {
          storageId,
          name: "gate.jpg",
          contentType: "image/jpeg",
          size: 15,
        },
      ],
    });

    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote?.files).toHaveLength(1);
    expect(quote!.files[0]!.name).toBe("gate.jpg");
    expect(quote!.files[0]!.competitor).toBe(false);
    expect(typeof quote!.files[0]!.url).toBe("string");
  });

  test("a competitor quote is flagged so it is not mistaken for a photo", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["%PDF-1.7"], { type: "application/pdf" })),
    );
    const id = await insertQuote(t, {
      files: [
        {
          storageId,
          name: "other-shop.pdf",
          contentType: "application/pdf",
          size: 8,
          kind: "competitor" as const,
        },
      ],
    });

    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote!.files[0]!.competitor).toBe(true);
  });

  test("a quote submitted before uploads existed reads back with an empty file list", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t, {
      job: { ...JOB, photoNames: ["gate.jpg"] },
    });

    const quote = await t.query(api.adminQuotes.get, { token, id });
    // Not undefined and not an error: an older row simply has nothing attached.
    expect(quote?.files).toEqual([]);
    expect(quote?.job.photoNames).toEqual(["gate.jpg"]);
  });

  test("a file whose blob was deleted still lists, with no URL", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);

    const storageId = await t.run(async (ctx) =>
      ctx.storage.store(new Blob(["bytes"], { type: "image/jpeg" })),
    );
    const id = await insertQuote(t, {
      files: [
        { storageId, name: "gate.jpg", contentType: "image/jpeg", size: 5 },
      ],
    });
    await t.run(async (ctx) => ctx.storage.delete(storageId));

    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote!.files[0]!.name).toBe("gate.jpg");
    expect(quote!.files[0]!.url).toBeNull();
  });

  test("the estimate is normalised to camelCase for the console", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t, { estimate: ESTIMATE });

    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote?.estimate).toEqual({
      title: "16 ft ranch gate",
      summary: "Fabricate and hang a 16 ft gate with a walk-through.",
      lineItems: [{ task: "Fabricate frame", crew: 1, hours: 8 }],
      hoursLow: 8,
      hoursHigh: 12,
      dollarsLow: 1200,
      dollarsHigh: 1800,
      confidence: "medium",
      questions: ["Is there power at the site?"],
    });
  });

  test("a draft that does not match the schema reads as no estimate, not a crash", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t, { estimate: { title: "half a draft" } });

    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote?.estimate).toBeNull();
  });

  test("an id that no longer exists reads as null rather than throwing", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t);
    await t.run(async (ctx) => ctx.db.delete(id));

    expect(await t.query(api.adminQuotes.get, { token, id })).toBeNull();
  });
});

describe("adminQuotes — turning a quote into a customer", () => {
  test("both write mutations refuse an unauthenticated caller", async () => {
    const t = convexTestWithLimiter();
    const id = await insertQuote(t);

    // Match the refusal itself, not merely "something threw": a bare
    // toThrow() is satisfied by the function not existing at all, which
    // proves nothing about the auth gate.
    await expect(
      t.mutation(api.adminQuotes.createCustomerFromQuote, {
        token: "not-a-session",
        id,
      }),
    ).rejects.toThrow(/not signed in/i);
    await expect(
      t.mutation(api.adminQuotes.createInvoiceFromQuote, {
        token: "not-a-session",
        id,
      }),
    ).rejects.toThrow(/not signed in/i);

    // Nothing was written on the way to being refused.
    const customers = await t.run(async (ctx) =>
      ctx.db.query("customers").collect(),
    );
    expect(customers).toHaveLength(0);
  });

  test("the quote's contact details come across onto the customer", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t, {
      company: "Serrano Builds",
      email: "m@serrano.example",
    });

    const result = await t.mutation(api.adminQuotes.createCustomerFromQuote, {
      token,
      id,
    });
    expect(result.outcome).toBe("created");

    const customer = await t.query(api.customers.get, {
      token,
      id: result.customerId,
    });
    expect(customer?.name).toBe("Marisol Serrano");
    expect(customer?.company).toBe("Serrano Builds");
    expect(customer?.phone).toBe("(817) 555-0142");
    expect(customer?.email).toBe("m@serrano.example");
  });

  test("saving the same quote twice links to the one customer, not two", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t);

    const first = await t.mutation(api.adminQuotes.createCustomerFromQuote, {
      token,
      id,
    });
    const second = await t.mutation(api.adminQuotes.createCustomerFromQuote, {
      token,
      id,
    });

    expect(first.outcome).toBe("created");
    expect(second.outcome).toBe("linked");
    expect(second.customerId).toBe(first.customerId);
    const customers = await t.run(async (ctx) =>
      ctx.db.query("customers").collect(),
    );
    expect(customers).toHaveLength(1);
  });

  test("a name already in the book stops and reports the match instead of duplicating", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const existing = await t.mutation(api.customers.create, {
      token,
      name: "Marisol Serrano",
    });
    const id = await insertQuote(t);

    const result = await t.mutation(api.adminQuotes.createCustomerFromQuote, {
      token,
      id,
    });
    expect(result.outcome).toBe("nameTaken");
    expect(result.customerId).toBe(existing);
    // Reporting a match is not a write: the quote is still unlinked.
    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote?.customer).toBeNull();
    expect(
      await t.run(async (ctx) => ctx.db.query("customers").collect()),
    ).toHaveLength(1);
  });

  test("the operator can link that match, or keep the two apart", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const existing = await t.mutation(api.customers.create, {
      token,
      name: "Marisol Serrano",
    });

    const sameId = await insertQuote(t);
    const linked = await t.mutation(api.adminQuotes.createCustomerFromQuote, {
      token,
      id: sameId,
      linkTo: existing,
    });
    expect(linked).toEqual({ outcome: "linked", customerId: existing });

    const otherId = await insertQuote(t, { requestId: "Q-2026-102" });
    const separate = await t.mutation(api.adminQuotes.createCustomerFromQuote, {
      token,
      id: otherId,
      createAnyway: true,
    });
    expect(separate.outcome).toBe("created");
    expect(separate.customerId).not.toBe(existing);
    expect(
      await t.run(async (ctx) => ctx.db.query("customers").collect()),
    ).toHaveLength(2);
  });
});

describe("adminQuotes — raising an invoice from a quote", () => {
  /** A signed-in owner with a rate set and one quote already saved as a
   * customer: the state every invoice test below starts from. */
  async function readyToInvoice(
    t: ReturnType<typeof convexTest>,
    overrides: Record<string, unknown> = {},
  ) {
    const token = await signedIn(t);
    await t.mutation(internal.settings.setLaborRate, { rate: 95 });
    const id = await insertQuote(t, overrides);
    await t.mutation(api.adminQuotes.createCustomerFromQuote, { token, id });
    return { token, id };
  }

  test("estimate tasks become hourly lines at the shop rate", async () => {
    const t = convexTestWithLimiter();
    const { token, id } = await readyToInvoice(t, {
      estimate: {
        ...ESTIMATE,
        line_items: [
          { task: "Fabricate frame", crew: 1, hours: 8 },
          // Two welders for three hours is six billable hours.
          { task: "Hang and align", crew: 2, hours: 3 },
        ],
      },
    });

    const invoiceId = await t.mutation(api.adminQuotes.createInvoiceFromQuote, {
      token,
      id,
    });
    const invoice = await t.query(api.invoices.get, { token, id: invoiceId });

    expect(invoice?.lineItems).toEqual([
      {
        qty: 8,
        unit: "hr",
        description: "Fabricate frame",
        rateCents: 9500,
        taxable: true,
      },
      {
        qty: 6,
        unit: "hr",
        description: "Hang and align",
        rateCents: 9500,
        taxable: true,
      },
    ]);
    // 14 hours at $95, server-computed, never sent by a client.
    expect(invoice?.totals.subtotalCents).toBe(133000);
  });

  test("a quote with no usable estimate still gets an invoice, with no lines", async () => {
    const t = convexTestWithLimiter();
    const { token, id } = await readyToInvoice(t);

    const invoiceId = await t.mutation(api.adminQuotes.createInvoiceFromQuote, {
      token,
      id,
    });
    const invoice = await t.query(api.invoices.get, { token, id: invoiceId });
    expect(invoice?.lineItems).toEqual([]);
    expect(invoice?.totals.balanceCents).toBe(0);
  });

  test("no labor rate set yet seeds the lines at zero rather than skipping them", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t, { estimate: ESTIMATE });
    await t.mutation(api.adminQuotes.createCustomerFromQuote, { token, id });

    const invoiceId = await t.mutation(api.adminQuotes.createInvoiceFromQuote, {
      token,
      id,
    });
    const invoice = await t.query(api.invoices.get, { token, id: invoiceId });
    expect(invoice?.lineItems).toHaveLength(1);
    expect(invoice?.lineItems[0]?.rateCents).toBe(0);
  });

  test("a quote with no customer is refused rather than billed to nobody", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await insertQuote(t, { estimate: ESTIMATE });

    await expect(
      t.mutation(api.adminQuotes.createInvoiceFromQuote, { token, id }),
    ).rejects.toThrow(/customer/i);
    expect(
      await t.run(async (ctx) => ctx.db.query("invoices").collect()),
    ).toHaveLength(0);
  });

  test("raising twice returns the same invoice instead of a second one", async () => {
    const t = convexTestWithLimiter();
    const { token, id } = await readyToInvoice(t, { estimate: ESTIMATE });

    const first = await t.mutation(api.adminQuotes.createInvoiceFromQuote, {
      token,
      id,
    });
    const second = await t.mutation(api.adminQuotes.createInvoiceFromQuote, {
      token,
      id,
    });
    expect(second).toBe(first);
    expect(
      await t.run(async (ctx) => ctx.db.query("invoices").collect()),
    ).toHaveLength(1);
  });

  test("raising an invoice moves the quote off 'new', so the status means something", async () => {
    const t = convexTestWithLimiter();
    const { token, id } = await readyToInvoice(t, { estimate: ESTIMATE });

    expect((await t.query(api.adminQuotes.get, { token, id }))?.status).toBe(
      "new",
    );
    await t.mutation(api.adminQuotes.createInvoiceFromQuote, { token, id });
    expect((await t.query(api.adminQuotes.get, { token, id }))?.status).toBe(
      "quoted",
    );
  });
});

describe("adminQuotes — the links read back both ways", () => {
  test("the quote names its customer and invoice; the invoice names its quote", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    await t.mutation(internal.settings.setLaborRate, { rate: 95 });
    const id = await insertQuote(t, { estimate: ESTIMATE });
    await t.mutation(api.adminQuotes.createCustomerFromQuote, { token, id });
    const invoiceId = await t.mutation(api.adminQuotes.createInvoiceFromQuote, {
      token,
      id,
    });

    const quote = await t.query(api.adminQuotes.get, { token, id });
    expect(quote?.customer?.name).toBe("Marisol Serrano");
    expect(quote?.invoice?._id).toBe(invoiceId);

    const invoice = await t.query(api.invoices.get, { token, id: invoiceId });
    expect(invoice?.quote).toEqual({
      _id: id,
      requestId: "Q-2026-101",
      name: "Marisol Serrano",
    });
  });

  test("the inbox list shows which requests have already been invoiced", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const billed = await insertQuote(t, { requestId: "Q-2026-101" });
    await insertQuote(t, { requestId: "Q-2026-102" });
    await t.mutation(api.adminQuotes.createCustomerFromQuote, {
      token,
      id: billed,
    });
    await t.mutation(api.adminQuotes.createInvoiceFromQuote, {
      token,
      id: billed,
    });

    const rows = await t.query(api.adminQuotes.list, { token });
    const byRequest = new Map(rows.map((row) => [row.requestId, row]));
    expect(byRequest.get("Q-2026-101")?.invoiceNumber).toMatch(/^TSWS-/);
    expect(byRequest.get("Q-2026-102")?.invoiceNumber).toBeUndefined();
  });
});
