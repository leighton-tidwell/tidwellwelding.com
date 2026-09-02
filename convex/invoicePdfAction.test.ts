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

/** The reference invoice, so the generated file is the real thing end to end. */
async function seedReferenceInvoice(
  t: ReturnType<typeof convexTest>,
  token: string,
) {
  const customerId = await t.mutation(api.customers.create, {
    token,
    name: "Bishop",
    phone: "(972) 999-7505",
  });
  const id = await t.mutation(api.invoices.create, {
    token,
    customerId,
    issuedAt: Date.UTC(2026, 7, 26, 17, 0, 0),
    jobPo: "Dual Swing Gate",
  });
  await t.mutation(api.invoices.update, {
    token,
    id,
    lineItems: [
      {
        qty: 1,
        unit: "ea",
        description: "LiftMaster LA400UL, dual-swing operator",
        rateCents: 299900,
        taxable: true,
      },
      {
        qty: 25,
        unit: "hr",
        description: "Fabrication, installation and mobilization labor",
        rateCents: 17500,
        taxable: true,
      },
      {
        qty: 1,
        unit: "lot",
        description: "Fuel — mobilization surcharge",
        rateCents: 4408,
        taxable: true,
      },
      {
        qty: 1,
        unit: "ea",
        description: "Steel tubing, metal and fabrication consumables",
        rateCents: 112460,
        taxable: true,
      },
      {
        qty: 1,
        unit: "ea",
        description: "Paint and finishing supplies",
        rateCents: 15000,
        taxable: true,
      },
      {
        qty: 1,
        unit: "ea",
        description: "Concrete",
        rateCents: 5000,
        taxable: true,
      },
      {
        qty: 1,
        unit: "ea",
        description: "Plasma-cutting consumables",
        rateCents: 5000,
        taxable: true,
      },
    ],
  });
  return id;
}

describe("invoice PDF generation", () => {
  test("produces a real PDF stored in Convex and hands back a URL", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await seedReferenceInvoice(t, token);

    const url = await t.action(api.invoicePdfAction.generate, { token, id });
    expect(typeof url).toBe("string");
    expect(url.length).toBeGreaterThan(0);

    // The stored blob must actually be a PDF, not an error page or empty file.
    // The assertions run inside t.run because raw bytes cannot cross the
    // convex-test boundary as a return value.
    const check = await t.run(async (ctx) => {
      const invoice = await ctx.db.get(id);
      if (!invoice?.pdfStorageId) return null;
      const blob = await ctx.storage.get(invoice.pdfStorageId);
      if (!blob) return null;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return {
        header: new TextDecoder().decode(bytes.slice(0, 5)),
        byteLength: bytes.byteLength,
      };
    });

    expect(check).not.toBeNull();
    expect(check!.header).toBe("%PDF-");
    // A one-page invoice is comfortably over 1KB; an empty or truncated file
    // would not be.
    expect(check!.byteLength).toBeGreaterThan(1000);
  });

  test("refuses to generate for a caller without a session", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await seedReferenceInvoice(t, token);

    await expect(
      t.action(api.invoicePdfAction.generate, { token: "not-a-token", id }),
    ).rejects.toThrow();
  });

  test("regenerating replaces the stored file rather than orphaning it", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const id = await seedReferenceInvoice(t, token);

    await t.action(api.invoicePdfAction.generate, { token, id });
    const first = await t.run(
      async (ctx) => (await ctx.db.get(id))?.pdfStorageId,
    );

    await t.action(api.invoicePdfAction.generate, { token, id });
    const second = await t.run(
      async (ctx) => (await ctx.db.get(id))?.pdfStorageId,
    );

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(second).not.toBe(first);

    // The superseded blob must be gone, or every download leaks storage.
    const oldStillThere = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(first!);
      return blob !== null;
    });
    expect(oldStillThere).toBe(false);
  });

  test("an invoice with no line items still generates rather than crashing", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "Empty Job",
    });
    const id = await t.mutation(api.invoices.create, { token, customerId });

    const url = await t.action(api.invoicePdfAction.generate, { token, id });
    expect(typeof url).toBe("string");
  });

  test("fails clearly when the invoice does not exist", async () => {
    const t = convexTestWithLimiter();
    const token = await signedIn(t);
    const customerId = await t.mutation(api.customers.create, {
      token,
      name: "X",
    });
    const id = await t.mutation(api.invoices.create, { token, customerId });
    await t.mutation(api.invoices.remove, { token, id });

    await expect(
      t.action(api.invoicePdfAction.generate, { token, id }),
    ).rejects.toThrow(/invoice/i);
  });
});
