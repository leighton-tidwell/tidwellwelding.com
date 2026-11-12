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

function setup() {
  const t = convexTest(schema, modules);
  rateLimiterComponent.register(t);
  return t;
}

async function signedIn(t: ReturnType<typeof convexTest>) {
  const userId = await t.mutation(internal.auth.createAdminUser, {
    email: "eric@tidwellwelding.com",
  });
  const setupToken = await t.mutation(internal.auth.issueSetupToken, {
    userId,
  });
  await t.mutation(api.auth.setPassword, {
    token: setupToken,
    password: "a-long-enough-password",
  });
  const result = await t.mutation(api.auth.login, {
    email: "eric@tidwellwelding.com",
    password: "a-long-enough-password",
  });
  if (!result.ok || !result.token)
    throw new Error("login failed in test setup");
  return result.token;
}

async function customer(t: ReturnType<typeof convexTest>, token: string) {
  return await t.mutation(api.customers.create, {
    token,
    name: "Ryerson",
    company: "Ryerson Inc",
    address: "4801 Glen Rose Hwy, Granbury TX 76048",
  });
}

describe("packing slips", () => {
  test("a new slip ships to the customer's company and address", async () => {
    const t = setup();
    const token = await signedIn(t);
    const id = await t.mutation(api.packingSlips.create, {
      token,
      customerId: await customer(t, token),
    });
    const slip = await t.query(api.packingSlips.get, { token, id });
    expect(slip?.number).toMatch(/^PS-\d{6}$/);
    expect(slip?.shipToName).toBe("Ryerson Inc");
    expect(slip?.shipToAddress).toBe("4801 Glen Rose Hwy, Granbury TX 76048");
  });

  test("a second slip the same day gets -2", async () => {
    const t = setup();
    const token = await signedIn(t);
    const customerId = await customer(t, token);
    const first = await t.mutation(api.packingSlips.create, {
      token,
      customerId,
    });
    const second = await t.mutation(api.packingSlips.create, {
      token,
      customerId,
    });
    const a = await t.query(api.packingSlips.get, { token, id: first });
    const b = await t.query(api.packingSlips.get, { token, id: second });
    expect(b?.number).toBe(`${a?.number}-2`);
  });

  test("copying an invoice brings the PO and goods, not the labour", async () => {
    const t = setup();
    const token = await signedIn(t);
    const invoiceId = await t.mutation(api.invoices.create, {
      token,
      customerId: await customer(t, token),
      jobPo: "4701230782",
    });
    await t.mutation(api.invoices.update, {
      token,
      id: invoiceId,
      lineItems: [
        {
          qty: 84,
          unit: "ea",
          description: "Welded frame",
          rateCents: 4500,
          taxable: true,
        },
        {
          qty: 6,
          unit: "hr",
          description: "Welding labor",
          rateCents: 17500,
          taxable: true,
        },
      ],
    });

    const id = await t.mutation(api.packingSlips.createFromInvoice, {
      token,
      invoiceId,
    });
    const slip = await t.query(api.packingSlips.get, { token, id });
    expect(slip?.poNumber).toBe("4701230782");
    expect(slip?.invoice?._id).toBe(invoiceId);
    expect(slip?.lineItems).toEqual([
      { partNumber: "", description: "Welded frame", qty: 84, unit: "ea" },
    ]);
  });

  test("edits are saved and a negative quantity is refused", async () => {
    const t = setup();
    const token = await signedIn(t);
    const id = await t.mutation(api.packingSlips.create, {
      token,
      customerId: await customer(t, token),
    });
    await t.mutation(api.packingSlips.update, {
      token,
      id,
      shipToName: "Voltagrid",
      shippedVia: "Truck",
      packages: "15",
      lineItems: [
        { partNumber: "1512-2914", description: "", qty: 84, unit: "ea" },
      ],
    });
    const slip = await t.query(api.packingSlips.get, { token, id });
    expect(slip?.shipToName).toBe("Voltagrid");
    expect(slip?.packages).toBe("15");
    expect(slip?.lineItems[0]?.partNumber).toBe("1512-2914");

    await expect(
      t.mutation(api.packingSlips.update, {
        token,
        id,
        lineItems: [{ partNumber: "x", description: "", qty: -1, unit: "ea" }],
      }),
    ).rejects.toThrow(/zero or more/);
  });

  test("nothing is readable without a session", async () => {
    const t = setup();
    await expect(
      t.query(api.packingSlips.list, { token: "not-a-session" }),
    ).rejects.toThrow(/Not signed in/);
  });
});
