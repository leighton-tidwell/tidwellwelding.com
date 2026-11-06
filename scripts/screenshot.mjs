#!/usr/bin/env node
// Proof for a PR: screenshot one page of the local stack.
//   make screenshot URL=/quote            desktop
//   make screenshot URL=/quote VIEWPORT=phone
//   make screenshot URL=/admin ADMIN=1    signed in as the seeded owner
// Starts `next dev` if nothing is serving WEB_PORT, and stops it afterwards.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { OWNER } from "../local/owner.mjs";

const base = `http://localhost:${process.env.WEB_PORT}`;
const route = process.env.URL || "/";
const phone = process.env.VIEWPORT === "phone";

const serving = () =>
  fetch(base).then(
    () => true,
    () => false,
  );

let server;
if (!(await serving())) {
  server = spawn(
    "pnpm",
    ["exec", "next", "dev", "--port", process.env.WEB_PORT],
    {
      stdio: "ignore",
      detached: true,
    },
  );
  const deadline = Date.now() + 120_000;
  while (!(await serving())) {
    if (Date.now() > deadline)
      throw new Error(`next dev never answered on ${base}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage(
    phone ? devices["iPhone 13"] : devices["Desktop Chrome"],
  );
  if (process.env.ADMIN) {
    await page.goto(`${base}/admin`);
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("heading", { name: "Invoices" }).waitFor();
  }
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  mkdirSync(".screenshots", { recursive: true });
  const slug =
    route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
  const file = `.screenshots/${slug}-${phone ? "phone" : "desktop"}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(file);
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}
