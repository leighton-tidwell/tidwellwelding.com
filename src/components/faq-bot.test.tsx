import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import { api } from "../../convex/_generated/api";

type FakeConvexClient = {
  mutation: ReturnType<typeof vi.fn>;
  action: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => {
  // The module reads this at import time; ensure the no-Turnstile path so
  // getToken() resolves "dev" immediately in tests.
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return {
    pathname: "/",
    client: undefined as unknown,
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
}));

vi.mock("convex/react", () => ({
  useConvex: () => state.client,
}));

vi.mock("@/lib/session", () => ({
  getSessionId: () => "sess-test",
}));

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: () => null,
}));

import FaqBot from "@/components/faq-bot";

afterEach(cleanup);

function makeClient(reply: { text: string; contact: boolean }): FakeConvexClient {
  return {
    mutation: vi.fn().mockResolvedValue("thread-1"),
    action: vi.fn().mockResolvedValue(reply),
  };
}

async function openPanel() {
  const user = userEvent.setup();
  render(<FaqBot />);
  await user.click(screen.getByRole("button", { name: /Ask the shop/ }));
  return user;
}

describe("FaqBot", () => {
  beforeEach(() => {
    state.pathname = "/";
    state.client = undefined;
  });

  test("opens the panel with the greeting", async () => {
    await openPanel();
    expect(
      screen.getByRole("dialog", { name: "Ask the shop" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ask about the service area, pricing, materials/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeInTheDocument();
  });

  test("message history is a focusable log region", async () => {
    await openPanel();
    const log = screen.getByRole("log");
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("tabindex", "0");
  });

  test("Escape closes the panel and returns focus to the pill", async () => {
    const user = await openPanel();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    const pill = screen.getByRole("button", { name: /Ask the shop/ });
    await waitFor(() => expect(pill).toHaveFocus());
  });

  test("the close button returns focus to the pill", async () => {
    const user = await openPanel();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    const pill = screen.getByRole("button", { name: /Ask the shop/ });
    await waitFor(() => expect(pill).toHaveFocus());
  });

  test("hides itself on /quote and /admin", () => {
    state.pathname = "/quote";
    const { container, unmount } = render(<FaqBot />);
    expect(container.querySelector(".faqbot-pill")).toBeNull();
    unmount();
    state.pathname = "/admin";
    const { container: c2 } = render(<FaqBot />);
    expect(c2.querySelector(".faqbot-pill")).toBeNull();
  });

  test("sends a message and renders the canned reply", async () => {
    const client = makeClient({
      text: "We cover Granbury and about an hour around it.",
      contact: false,
    });
    state.client = client;
    const user = await openPanel();

    await user.type(
      screen.getByRole("textbox", { name: "Ask a question" }),
      "Do you travel?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText("Do you travel?")).toBeInTheDocument();
    expect(
      await screen.findByText("We cover Granbury and about an hour around it."),
    ).toBeInTheDocument();

    expect(client.mutation).toHaveBeenCalledTimes(1);
    expect(client.mutation).toHaveBeenCalledWith(api.chat.startThread, {
      sessionId: "sess-test",
    });
    expect(client.action).toHaveBeenCalledWith(api.chat.sendMessage, {
      threadId: "thread-1",
      sessionId: "sess-test",
      text: "Do you travel?",
      turnstileToken: "dev",
    });
    // No contact CTAs on a plain answer.
    expect(screen.queryByRole("link", { name: "Call Eric" })).toBeNull();
  });

  test("reply with the contact flag shows Call/Email CTAs", async () => {
    state.client = makeClient({
      text: "That one needs Eric. Call him direct.",
      contact: true,
    });
    const user = await openPanel();

    await user.type(
      screen.getByRole("textbox", { name: "Ask a question" }),
      "Can you weld titanium underwater?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("That one needs Eric. Call him direct."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call Eric" })).toHaveAttribute(
      "href",
      "tel:8178946357",
    );
    expect(screen.getByRole("link", { name: "Email Eric" })).toHaveAttribute(
      "href",
      "mailto:eric@tidwellwelding.com",
    );
  });

  test("input over 500 chars is clamped before sending", async () => {
    const client = makeClient({ text: "Short answer.", contact: false });
    state.client = client;
    const user = await openPanel();

    const input = screen.getByRole("textbox", { name: "Ask a question" });
    expect(input).toHaveAttribute("maxLength", "500");

    // fireEvent bypasses the browser maxLength clamp; send() must still slice.
    fireEvent.change(input, { target: { value: "x".repeat(600) } });
    await user.click(screen.getByRole("button", { name: "Send" }));

    await screen.findByText("Short answer.");
    const sent = client.action.mock.calls[0][1] as { text: string };
    expect(sent.text).toHaveLength(500);
  });

  test("no Convex client: shows the fallback message with CTAs, never throws", async () => {
    state.client = undefined;
    const user = await openPanel();

    await user.type(
      screen.getByRole("textbox", { name: "Ask a question" }),
      "Anyone there?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText(/Can't reach the assistant right now/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call Eric" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Email Eric" })).toBeInTheDocument();
  });

  test("backend error path also falls back instead of throwing", async () => {
    state.client = {
      mutation: vi.fn().mockResolvedValue("thread-1"),
      action: vi.fn().mockRejectedValue(new Error("network down")),
    };
    const user = await openPanel();

    await user.type(
      screen.getByRole("textbox", { name: "Ask a question" }),
      "Pricing?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText(/Can't reach the assistant right now/),
    ).toBeInTheDocument();
  });
});
