#!/usr/bin/env node
// Proof for a PR: screenshot one page of the local stack.
//   make screenshot URL=/quote            desktop
//   make screenshot URL=/quote VIEWPORT=phone
//   make screenshot URL=/admin ADMIN=1    signed in as the seeded owner
//   make screenshot URL=/admin ADMIN=1 SCHEME=dark CLICK="Quotes,/^Q-/"
//     SCHEME picks the color scheme; CLICK presses buttons by accessible name,
//     in order, to reach a view with no URL of its own (/.../ is a regex).
// Starts `next dev` if nothing is serving WEB_PORT, and stops it afterwards.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, devices } from "@playwright/test";
import { OWNER } from "../local/owner.mjs";

const base = `http://localhost:${process.env.WEB_PORT}`;
const route = process.env.URL || "/";
const phone = process.env.VIEWPORT === "phone";
// Matches STORAGE_KEY in src/app/admin/use-admin-session.ts.
const SESSION_KEY = "tsws_admin_session";
const SESSION_FILE = ".screenshots/.admin-session";
const dark = process.env.SCHEME === "dark";
const clicks = (process.env.CLICK || "").split(",").filter(Boolean);
const buttonName = (name) =>
  name.startsWith("/") && name.endsWith("/")
    ? new RegExp(name.slice(1, -1))
    : name;

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
  const page = await browser.newPage({
    ...(phone ? devices["iPhone 13"] : devices["Desktop Chrome"]),
    colorScheme: dark ? "dark" : "light",
  });
  if (process.env.ADMIN) {
    // Login is rate limited per email, so a batch of shots replays one session
    // token instead of signing in for every picture.
    const signedIn = () =>
      page
        .getByRole("heading", { name: "Invoices" })
        .waitFor({ timeout: 15_000 })
        .then(
          () => true,
          () => false,
        );
    await page.goto(`${base}/admin`);
    let reused = false;
    if (existsSync(SESSION_FILE)) {
      const token = readFileSync(SESSION_FILE, "utf8");
      await page.evaluate(
        ([key, value]) => window.sessionStorage.setItem(key, value),
        [SESSION_KEY, token],
      );
      await page.reload();
      reused = await signedIn();
    }
    if (!reused) {
      await page.evaluate(
        (key) => window.sessionStorage.removeItem(key),
        SESSION_KEY,
      );
      await page.reload();
      await page.getByLabel("Email").fill(OWNER.email);
      await page.getByLabel("Password").fill(OWNER.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await page.getByRole("heading", { name: "Invoices" }).waitFor();
      mkdirSync(".screenshots", { recursive: true });
      writeFileSync(
        SESSION_FILE,
        await page.evaluate(
          (key) => window.sessionStorage.getItem(key) ?? "",
          SESSION_KEY,
        ),
      );
    }
  }
  await page.goto(`${base}${route}`, { waitUntil: "networkidle" });
  for (const name of clicks) {
    await page
      .getByRole("button", { name: buttonName(name), exact: true })
      .first()
      .click();
    await page.waitForLoadState("networkidle");
    // Convex answers over a websocket, which networkidle does not see.
    await page.waitForTimeout(800);
  }
  mkdirSync(".screenshots", { recursive: true });
  const slug =
    [route, ...clicks]
      .join("-")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "") || "home";
  const who = process.env.ADMIN
    ? ""
    : route.startsWith("/admin")
      ? "-signed-out"
      : "";
  const file = `.screenshots/${slug}${who}-${phone ? "phone" : "desktop"}${dark ? "-dark" : ""}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(file);
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}
