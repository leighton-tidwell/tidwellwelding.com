import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import schema from "./schema";

// Explicit module map: convex-test's automatic glob does not resolve under pnpm.
// Excludes test files and type declarations, keeps _generated/*.js.
const modules = import.meta.glob([
  "./**/*.ts",
  "./**/*.js",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
]);

test("convex-test plumbing: insert and read a quotes row", async () => {
  const t = convexTest(schema, modules);

  const createdAt = Date.now();
  const id = await t.run(async (ctx) => {
    return ctx.db.insert("quotes", {
      requestId: "smoke-test-request",
      name: "Smoke Test",
      phone: "555-0100",
      job: {
        type: "repair",
        desc: "Smoke test job description",
      },
      slot: "standard",
      status: "new",
      createdAt,
    });
  });

  const row = await t.run(async (ctx) => ctx.db.get(id));
  expect(row).not.toBeNull();
  expect(row!.requestId).toBe("smoke-test-request");
  expect(row!.name).toBe("Smoke Test");
  expect(row!.job.type).toBe("repair");
  expect(row!.createdAt).toBe(createdAt);

  const byRequestId = await t.run(async (ctx) =>
    ctx.db
      .query("quotes")
      .withIndex("by_requestId", (q) => q.eq("requestId", "smoke-test-request"))
      .unique(),
  );
  expect(byRequestId?._id).toBe(id);
});
