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

/** A signed-in owner. Every admin call needs one of these. */
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
const LINE = {
  qty: 1,
  unit: "ea" as const,
  description: "Ranch gate",
  rateCents: 100000,
  taxable: true,
};

describe("customers", () => {
  test("a saved customer comes back with its details intact", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);

    const id = await t.mutation(api.customers.create, {
      token,
      name: "Serrano Builds",
      company: "Serrano Builds LLC",
      phone: "(817) 555-0142",
      email: "m@serrano.example",
    });

    const customer = await t.query(api.customers.get, { token, id });
    expect(customer?.name).toBe("Serrano Builds");
    expect(customer?.phone).toBe("(817) 555-0142");
  });

  test("customers list alphabetically so the picker is predictable", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);

    for (const name of ["Whitfield Ops", "Boyd Equipment", "McAllen Ranch"]) {
      await t.mutation(api.customers.create, { token, name });
    }

    const list = await t.query(api.customers.list, { token });
    expect(list.map((c) => c.name)).toEqual([
      "Boyd Equipment",
      "McAllen Ranch",
      "Whitfield Ops",
    ]);
  });

  test("a customer requires a name", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    await expect(
      t.mutation(api.customers.create, { token, name: "   " }),
    ).rejects.toThrow(/name/i);
  });

  test("updating a customer changes only what was passed", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await t.mutation(api.customers.create, {
      token,
      name: "Boyd Equipment",
      phone: "(817) 555-0100",
    });

    await t.mutation(api.customers.update, {
      token,
      id,
      phone: "(254) 555-0199",
    });

    const customer = await t.query(api.customers.get, { token, id });
    expect(customer?.phone).toBe("(254) 555-0199");
    expect(customer?.name).toBe("Boyd Equipment");
  });
});

describe("customers — access control", () => {
  test("every customer function refuses an unauthenticated caller", async () => {
    const t = convexTestWithLimiter();
    const bad = "not-a-real-session-token";

    await expect(
      t.mutation(api.customers.create, { token: bad, name: "Nope" }),
    ).rejects.toThrow();
    await expect(t.query(api.customers.list, { token: bad })).rejects.toThrow();
  });

  test("a customer cannot be read with an expired session", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await t.mutation(api.customers.create, { token, name: "Boyd" });

    // Age the session past its expiry.
    await t.run(async (ctx) => {
      const session = await ctx.db
        .query("adminSessions")
        .withIndex("by_token", (q) => q.eq("token", token))
        .unique();
      if (session)
        await ctx.db.patch(session._id, { expiresAt: Date.now() - 1 });
    });

    await expect(t.query(api.customers.get, { token, id })).rejects.toThrow();
  });
});

describe("invoice numbering", () => {
  test("the first invoice of the day uses the bare date, matching his format", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });

    const id = await t.mutation(api.invoices.create, {
      token,
      customerId,
      issuedAt: Date.UTC(2026, 7, 26, 17, 0, 0), // 26 Aug 2026, midday CT
    });

    const invoice = await t.query(api.invoices.get, { token, id });
    expect(invoice?.number).toBe("TSWS-082626");
  });

  test("a second invoice the same day gets a -2 suffix, not a collision", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });
    const issuedAt = Date.UTC(2026, 7, 26, 17, 0, 0);

    const first = await t.mutation(api.invoices.create, {
      token,
      customerId,
      issuedAt,
    });
    const second = await t.mutation(api.invoices.create, {
      token,
      customerId,
      issuedAt,
    });
    const third = await t.mutation(api.invoices.create, {
      token,
      customerId,
      issuedAt,
    });

    const numbers = await Promise.all(
      [first, second, third].map(
        async (id) => (await t.query(api.invoices.get, { token, id }))?.number,
      ),
    );
    expect(numbers).toEqual(["TSWS-082626", "TSWS-082626-2", "TSWS-082626-3"]);
  });

  test("a different day starts numbering over", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });

    await t.mutation(api.invoices.create, {
      token,
      customerId,
      issuedAt: Date.UTC(2026, 7, 26, 17, 0, 0),
    });
    const next = await t.mutation(api.invoices.create, {
      token,
      customerId,
      issuedAt: Date.UTC(2026, 7, 27, 17, 0, 0),
    });

    const invoice = await t.query(api.invoices.get, { token, id: next });
    expect(invoice?.number).toBe("TSWS-082726");
  });
});

describe("invoices", () => {
  test("a new invoice starts as a draft with sane defaults", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });

    const id = await t.mutation(api.invoices.create, { token, customerId });
    const invoice = await t.query(api.invoices.get, { token, id });

    expect(invoice?.status).toBe("draft");
    expect(invoice?.lineItems).toEqual([]);
    expect(invoice?.taxRateBasisPoints).toBe(825); // Granbury combined rate
    expect(invoice?.terms).toBe("Due upon receipt");
  });

  test("a new invoice defaults its due date to the day it was issued", async () => {
    // Eric's terms are due-on-receipt, so the useful default is today. He can
    // still move the date before generating the PDF.
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });

    const issuedAt = Date.UTC(2026, 7, 31, 15);
    const id = await t.mutation(api.invoices.create, {
      token,
      customerId,
      issuedAt,
    });
    const invoice = await t.query(api.invoices.get, { token, id });

    expect(invoice?.dueAt).toBe(issuedAt);
  });

  test("the due date can be moved without touching the issue date", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });

    const issuedAt = Date.UTC(2026, 7, 31, 15);
    const id = await t.mutation(api.invoices.create, {
      token,
      customerId,
      issuedAt,
    });

    const dueAt = Date.UTC(2026, 8, 30, 15);
    await t.mutation(api.invoices.update, { token, id, dueAt });

    const invoice = await t.query(api.invoices.get, { token, id });
    expect(invoice?.dueAt).toBe(dueAt);
    expect(invoice?.issuedAt).toBe(issuedAt);
  });

  test("reading an invoice returns server-computed totals, not client numbers", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });
    const id = await t.mutation(api.invoices.create, { token, customerId });

    await t.mutation(api.invoices.update, {
      token,
      id,
      lineItems: [
        {
          qty: 25,
          unit: "hr",
          description: "Labor",
          rateCents: 17500,
          taxable: true,
        },
        {
          qty: 1,
          unit: "lot",
          description: "Fuel",
          rateCents: 4408,
          taxable: true,
        },
      ],
    });

    const invoice = await t.query(api.invoices.get, { token, id });
    expect(invoice?.totals.subtotalCents).toBe(441908);
    expect(invoice?.totals.taxCents).toBe(36457);
    expect(invoice?.totals.balanceCents).toBe(478365);
  });

  test("the invoice carries its customer so the editor needs one read", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Serrano Builds",
      phone: "(817) 555-0142",
    });
    const id = await t.mutation(api.invoices.create, { token, customerId });

    const invoice = await t.query(api.invoices.get, { token, id });
    expect(invoice?.customer.name).toBe("Serrano Builds");
    expect(invoice?.customer.phone).toBe("(817) 555-0142");
  });

  test("status moves through the lifecycle the owner drives by hand", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });
    const id = await t.mutation(api.invoices.create, { token, customerId });

    await t.mutation(api.invoices.setStatus, { token, id, status: "sent" });
    expect((await t.query(api.invoices.get, { token, id }))?.status).toBe(
      "sent",
    );

    await t.mutation(api.invoices.setStatus, { token, id, status: "paid" });
    expect((await t.query(api.invoices.get, { token, id }))?.status).toBe(
      "paid",
    );
  });

  test("a line item with a negative rate is refused before it can be saved", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });
    const id = await t.mutation(api.invoices.create, { token, customerId });

    await expect(
      t.mutation(api.invoices.update, {
        token,
        id,
        lineItems: [
          {
            qty: 1,
            unit: "ea",
            description: "Bad",
            rateCents: -500,
            taxable: true,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  test("a fractional cent rate is refused rather than silently rounded", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });
    const id = await t.mutation(api.invoices.create, { token, customerId });

    await expect(
      t.mutation(api.invoices.update, {
        token,
        id,
        lineItems: [
          {
            qty: 1,
            unit: "ea",
            description: "Bad",
            rateCents: 10.5,
            taxable: true,
          },
        ],
      }),
    ).rejects.toThrow();
  });

  test("invoices for a customer come back newest first", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });

    const older = await t.mutation(api.invoices.create, {
      token,
      customerId,
      issuedAt: Date.UTC(2026, 7, 20, 17, 0, 0),
    });
    const newer = await t.mutation(api.invoices.create, {
      token,
      customerId,
      issuedAt: Date.UTC(2026, 7, 26, 17, 0, 0),
    });

    const list = await t.query(api.invoices.listForCustomer, {
      token,
      customerId,
    });
    expect(list.map((i) => i._id)).toEqual([newer, older]);
  });

  test("the customer view totals only what was actually billed, ignoring voids", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });

    const paid = await t.mutation(api.invoices.create, { token, customerId });
    await t.mutation(api.invoices.update, {
      token,
      id: paid,
      lineItems: [LINE],
    });
    await t.mutation(api.invoices.setStatus, {
      token,
      id: paid,
      status: "paid",
    });

    const voided = await t.mutation(api.invoices.create, { token, customerId });
    await t.mutation(api.invoices.update, {
      token,
      id: voided,
      lineItems: [LINE],
    });
    await t.mutation(api.invoices.setStatus, {
      token,
      id: voided,
      status: "void",
    });

    const summary = await t.query(api.customers.summary, {
      token,
      id: customerId,
    });
    // One $1,000 invoice + 8.25% tax. The voided one must not count.
    expect(summary.billedCents).toBe(108250);
    expect(summary.invoiceCount).toBe(2);
  });

  test("deleting an invoice removes it from the list", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });
    const id = await t.mutation(api.invoices.create, { token, customerId });

    await t.mutation(api.invoices.remove, { token, id });

    expect(await t.query(api.invoices.get, { token, id })).toBeNull();
  });
});

describe("invoices — access control", () => {
  test("every invoice function refuses an unauthenticated caller", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });
    const id = await t.mutation(api.invoices.create, { token, customerId });

    const bad = "not-a-real-session-token";
    await expect(t.query(api.invoices.list, { token: bad })).rejects.toThrow();
    await expect(
      t.query(api.invoices.get, { token: bad, id }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.invoices.create, { token: bad, customerId }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.invoices.update, { token: bad, id, notes: "hi" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.invoices.setStatus, { token: bad, id, status: "paid" }),
    ).rejects.toThrow();
    await expect(
      t.mutation(api.invoices.remove, { token: bad, id }),
    ).rejects.toThrow();
  });

  test("an invoice cannot reference a customer that does not exist", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Boyd",
    });
    await t.mutation(api.customers.remove, { token, id: customerId });

    await expect(
      t.mutation(api.invoices.create, { token, customerId }),
    ).rejects.toThrow(/customer/i);
  });
});

describe("shop settings", () => {
  test("the labor rate round-trips so the editor can prefill hourly lines", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);

    await t.mutation(api.settings.setLaborRateAdmin, { token, rate: 175 });
    expect(await t.query(api.settings.getLaborRateAdmin, { token })).toBe(175);
  });

  test("the labor rate is not readable without a session", async () => {
    const t = convexTestWithLimiter();
    await expect(
      t.query(api.settings.getLaborRateAdmin, { token: "nope" }),
    ).rejects.toThrow();
  });
});
