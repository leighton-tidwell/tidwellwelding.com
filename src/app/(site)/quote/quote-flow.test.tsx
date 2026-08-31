import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  afterAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const MOCK_ESTIMATE = {
  title: "Excavator bucket crack repair",
  summary: "Vee out the crack, preheat and weld out with 7018.",
  line_items: [
    { task: "Assess, prep and fit-up", crew: 1, hours: 2 },
    { task: "Weld-out", crew: 2, hours: 4 },
    { task: "Grind, dress and inspect", crew: 1, hours: 1 },
  ],
  hours_low: 6,
  hours_high: 8,
  dollars_low: 1200,
  dollars_high: 2400,
  questions: ["Is the machine at your yard or in the field?"],
};

const h = vi.hoisted(() => {
  // Read at module scope by quote-flow.tsx; must exist before import so the
  // (mocked) Turnstile widget renders on step 2.
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "test-site-key";
  return {
    action: vi.fn(),
  };
});

vi.mock("convex/react", () => ({
  useConvex: () => ({ action: h.action }),
}));

vi.mock("@/lib/session", () => ({
  getSessionId: () => "sess-test",
}));

vi.mock("@marsidev/react-turnstile", async () => {
  const React = await import("react");
  return {
    Turnstile: ({ onSuccess }: { onSuccess?: (token: string) => void }) => {
      React.useEffect(() => {
        onSuccess?.("test-turnstile-token");
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return <div data-testid="turnstile-stub" />;
    },
  };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import QuoteFlow from "./quote-flow";

afterEach(cleanup);

afterAll(() => {
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
});

/** In-memory localStorage stand-in; jsdom's own store stays untouched. */
function mockLocalStorage() {
  const store = new Map<string, string>();
  const stub = {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
    key: vi.fn(() => null),
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: stub,
  });
  return store;
}

let store: Map<string, string>;

beforeEach(() => {
  h.action.mockReset();
  h.action.mockImplementation(async (_ref: unknown, args: Record<string, unknown>) => {
    if ("slot" in args) return { ok: true, requestId: "Q-2026-777" };
    return MOCK_ESTIMATE;
  });
  store = mockLocalStorage();
  window.scrollTo = vi.fn();
});

async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^Job type/), "Pipe welding");
  await user.type(
    screen.getByLabelText(/What needs welding or building/),
    "Cracked bucket ear on a 320 excavator.",
  );
  await user.click(screen.getByRole("button", { name: "Send the details" }));
}

describe("QuoteFlow", () => {
  test("step 1 blocks advance and shows both validation messages", async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);

    await user.click(screen.getByRole("button", { name: "Send the details" }));

    expect(screen.getByText("Pick a job type.")).toBeInTheDocument();
    expect(
      screen.getByText("Describe the job in a sentence or two."),
    ).toBeInTheDocument();
    // Errors are exposed as alerts and focus lands on the first invalid field.
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(screen.getByLabelText(/^Job type/)).toHaveFocus();
    // Still on step 1.
    expect(
      screen.queryByText("Where do we send the numbers"),
    ).not.toBeInTheDocument();
  });

  test("stepper renders as a labelled ordered list", () => {
    const { container } = render(<QuoteFlow />);
    const list = container.querySelector("ol.qf-steps");
    expect(list).toBeInTheDocument();
    expect(list).toHaveAttribute("aria-label", "Quote progress");
    const steps = list?.querySelectorAll("li.qf-step");
    expect(steps).toHaveLength(4);
    expect(steps?.[0]).toHaveAttribute("aria-current", "step");
  });

  test("file inputs are focusable (visually hidden, not display:none)", () => {
    const { container } = render(<QuoteFlow />);
    const fileInputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="file"]',
    );
    expect(fileInputs).toHaveLength(2);
    for (const input of Array.from(fileInputs)) {
      expect(input.style.display).not.toBe("none");
      input.focus();
      expect(input).toHaveFocus();
      // Wrapped in a label so the control keeps an accessible name.
      expect(input.closest("label")?.textContent).toBeTruthy();
    }
  });

  test("emergency plate appears when the timeline is emergency", async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);

    expect(screen.queryByText("Emergency? Skip the form.")).toBeNull();

    await user.selectOptions(
      screen.getByLabelText("Timeline"),
      "Emergency. Right now.",
    );

    const plate = screen.getByText("Emergency? Skip the form.");
    expect(plate.closest("a")).toHaveAttribute("href", "tel:8178946357");
    expect(screen.getByText("Call (817) 894-6357")).toBeInTheDocument();
  });

  test("step 2 validates the phone number", async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    await fillStep1(user);

    // Focus moves to the new step's heading after the transition.
    expect(screen.getByText("Where do we send the numbers")).toHaveFocus();
    // Turnstile stub mounted with step 2.
    expect(screen.getByTestId("turnstile-stub")).toBeInTheDocument();

    // Empty name + short phone both flag.
    await user.type(screen.getByLabelText(/^Phone/), "123");
    await user.click(screen.getByRole("button", { name: "Run the estimate" }));
    expect(screen.getByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a 10-digit number.")).toBeInTheDocument();
    // Focus lands on the first invalid field.
    expect(screen.getByLabelText(/^Name/)).toHaveFocus();

    // Formatting characters are stripped for the ten-digit check.
    await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
    await user.clear(screen.getByLabelText(/^Phone/));
    await user.type(screen.getByLabelText(/^Phone/), "(817) 555-010");
    await user.click(screen.getByRole("button", { name: "Run the estimate" }));
    expect(screen.getByText("Enter a 10-digit number.")).toBeInTheDocument();
  });

  test("full flow: estimate renders, slot gates submit, step 4 shows the returned requestId", async () => {
    const user = userEvent.setup();
    const { container } = render(<QuoteFlow />);

    await fillStep1(user);
    await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
    await user.type(screen.getByLabelText(/^Phone/), "(817) 555-0100");
    await user.click(screen.getByRole("button", { name: "Run the estimate" }));

    // Drafting panel shows while the (min 700ms) estimate settles.
    expect(screen.getByText("Drafting your numbers")).toBeInTheDocument();

    // Mocked estimate lands: title, line items, hours, dollar range.
    expect(
      await screen.findByText("Excavator bucket crack repair", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Vee out the crack, preheat and weld out with 7018."),
    ).toBeInTheDocument();
    // Busy→ready swap is announced through the persistent status region.
    expect(screen.getByRole("status")).toHaveTextContent("Estimate ready.");
    for (const li of MOCK_ESTIMATE.line_items) {
      expect(screen.getByText(li.task)).toBeInTheDocument();
    }
    expect(screen.getByText("Total man-hours 6–8")).toBeInTheDocument();
    expect(screen.getByText("$1,200 – $2,400")).toBeInTheDocument();
    expect(
      screen.getByText("Is the machine at your yard or in the field?"),
    ).toBeInTheDocument();

    // AI-draft disclaimers.
    expect(screen.getByText("AI draft — not a final quote")).toBeInTheDocument();
    expect(
      screen.getByText(/An AI drafted these numbers from your description/),
    ).toBeInTheDocument();

    // The estimate action got the job, session and turnstile token.
    const [estRef, estArgs] = h.action.mock.calls[0] as [
      unknown,
      Record<string, unknown>,
    ];
    expect(estRef).toBeTruthy();
    expect(estArgs).toMatchObject({
      type: "Pipe welding",
      desc: "Cracked bucket ear on a 320 excavator.",
      sessionId: "sess-test",
      turnstileToken: "test-turnstile-token",
    });

    // Submit is gated on a slot.
    const submitBtn = screen.getByRole("button", { name: "Send the request" });
    expect(submitBtn).toBeDisabled();

    const slots = container.querySelectorAll<HTMLButtonElement>(".qf-slot");
    expect(slots.length).toBe(10);
    await user.click(slots[0]);
    expect(slots[0]).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/^Slot: /)).toBeInTheDocument();
    expect(submitBtn).toBeEnabled();

    await user.click(submitBtn);

    // Step 4 shows the requestId from the mocked submit response, and the
    // confirmation heading takes focus.
    expect(await screen.findByText("Request sent.")).toHaveFocus();
    const confirmation = screen.getByText(/Your reference is Q-2026-777/);
    expect(confirmation).toBeInTheDocument();
    // The chosen slot is read back in the confirmation copy.
    expect(confirmation.textContent).toMatch(/at your slot: .*· Morning/);
    expect(
      screen.getByText(
        "A copy went to eric@tidwellwelding.com. Check your email for the recap.",
      ),
    ).toBeInTheDocument();

    // Confirmation links: back home and to the work log — never to /admin.
    expect(screen.getByRole("link", { name: "Back to the site" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "See the work" })).toHaveAttribute(
      "href",
      "/work",
    );
    expect(
      Array.from(document.querySelectorAll("a")).filter((a) =>
        (a.getAttribute("href") ?? "").startsWith("/admin"),
      ),
    ).toHaveLength(0);

    // The submit action carried the contact, slot and token.
    const submitCall = h.action.mock.calls.find(
      ([, args]) => "slot" in (args as Record<string, unknown>),
    );
    expect(submitCall).toBeTruthy();
    const submitArgs = submitCall?.[1] as Record<string, unknown>;
    expect(submitArgs).toMatchObject({
      name: "Jane Rig",
      phone: "(817) 555-0100",
      turnstileToken: "test-turnstile-token",
      sessionId: "sess-test",
    });
    expect(String(submitArgs.requestId)).toMatch(/^Q-\d{4}-\d{3}$/);
    expect(String(submitArgs.slot)).toMatch(/· Morning$/);

    // The request also lands in mocked localStorage for local history.
    const saved = JSON.parse(store.get("tsws_quotes") ?? "[]");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: "Q-2026-777", status: "New" });
  });

  test("backend unreachable: fallback estimate still renders with the disclaimer", async () => {
    h.action.mockRejectedValue(new Error("convex down"));
    const user = userEvent.setup();
    render(<QuoteFlow />);

    await fillStep1(user);
    await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
    await user.type(screen.getByLabelText(/^Phone/), "8175550100");
    await user.click(screen.getByRole("button", { name: "Run the estimate" }));

    // Static fallback drafts numbers instead of crashing.
    expect(
      await screen.findByText(/An AI drafted these numbers/, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Weld-out")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send the request" }),
    ).toBeDisabled();
  });
});
