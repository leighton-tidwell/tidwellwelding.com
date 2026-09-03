import { expect, test } from "@playwright/test";

const FALLBACK_TEXT =
  "Can't reach the assistant right now. Call or email Eric direct — he answers.";

/**
 * @live — "Ask the shop" sends ONE real Anthropic call through the dev
 * Convex deployment (api.chat.sendMessage). The over-length check below is
 * client-side only (the input's maxLength cap) and never sends, so this file
 * stays at exactly one AI call.
 */
test(
  "Ask the shop answers the service-area question without dollar figures",
  { tag: "@live" },
  async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto("/", { timeout: 60_000 });

    await page.getByRole("button", { name: "Ask the shop" }).click();
    const panel = page.getByRole("dialog", { name: "Ask the shop" });
    await expect(panel).toBeVisible();

    const input = page.getByLabel("Ask a question");
    await input.fill("What area do you cover?");
    await input.press("Enter");

    // The greeting is the first bot bubble; the reply is the second.
    const botBubbles = page.locator(".faqbot-bubble--bot");
    await expect(botBubbles).toHaveCount(2, { timeout: 30_000 });

    const reply = (await botBubbles.nth(1).textContent())?.trim() ?? "";
    expect(reply.length).toBeGreaterThan(0);
    // A real answer, not the unreachable/verification error path.
    expect(reply).not.toBe(FALLBACK_TEXT);
    expect(reply).not.toContain("Verification failed");
    expect(reply).not.toContain("Keep it under 500 characters");
    // Never any dollar figures in chat replies.
    expect(reply).not.toMatch(/\$\s*\d/);
    // The service-area answer names the territory.
    expect(reply).toMatch(
      /granbury|stephenville|fort worth|dfw|weatherford|cleburne/i,
    );

    // ---- Over-length input is blocked client-side (no send, no AI call) --
    await expect(input).toHaveAttribute("maxlength", "500");
    await input.fill("x".repeat(499));
    await input.pressSequentially("yy"); // tries to reach 501; capped at 500
    expect((await input.inputValue()).length).toBe(500);
    // Still exactly one exchange on screen — nothing extra was sent.
    await expect(botBubbles).toHaveCount(2);
  },
);
