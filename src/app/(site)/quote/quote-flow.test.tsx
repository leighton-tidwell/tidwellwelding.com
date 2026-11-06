import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterAll,
  afterEach,
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
    mutation: vi.fn(),
    // The real widget takes a few seconds to solve. Most tests want the
    // token immediately; the gating tests set this false and call solve().
    autoSolve: true,
    solve: () => {},
  };
});

vi.mock("convex/react", () => ({
  useConvex: () => ({ action: h.action, mutation: h.mutation }),
}));

vi.mock("@/lib/session", () => ({
  getSessionId: () => "sess-test",
}));

vi.mock("@marsidev/react-turnstile", async () => {
  const React = await import("react");
  return {
    Turnstile: ({ onSuccess }: { onSuccess?: (token: string) => void }) => {
      React.useEffect(() => {
        h.solve = () => onSuccess?.("test-turnstile-token");
        if (h.autoSolve) onSuccess?.("test-turnstile-token");
      }, [onSuccess]);
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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

const fetchMock = vi.fn();

beforeEach(() => {
  h.mutation.mockReset();
  h.mutation.mockResolvedValue("https://upload.test/1");
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ storageId: "stor-1" }),
  });
  vi.stubGlobal("fetch", fetchMock);
  h.action.mockReset();
  h.action.mockImplementation(
    async (_ref: unknown, args: Record<string, unknown>) => {
      if ("slot" in args) return { ok: true, requestId: "Q-2026-777" };
      return MOCK_ESTIMATE;
    },
  );
  store = mockLocalStorage();
  window.scrollTo = vi.fn();
  h.autoSolve = true;
  h.solve = () => {};
});

/** A rejection shaped like the ConvexError the backend throws: the
 * customer-ready message rides on `data`. */
const convexError = (message: string) =>
  Object.assign(new Error(`Uncaught ConvexError: ${message}`), {
    data: message,
  });

/** Estimate resolves, submit rejects with `err`. */
function submitRejects(err: unknown) {
  h.action.mockImplementation(async (_ref: unknown, args: object) => {
    if ("slot" in args) throw err;
    return MOCK_ESTIMATE;
  });
}

async function fillStep1(user: ReturnType<typeof userEvent.setup>) {
  await fillStep1Fields(user);
  await user.click(screen.getByRole("button", { name: "Send the details" }));
}

async function fillStep1Fields(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText(/^Job type/), "Pipe welding");
  await user.type(
    screen.getByLabelText(/What needs welding or building/),
    "Cracked bucket ear on a 320 excavator.",
  );
}

const CNC = "CNC plasma cutting / signs";

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
    const fileInputs =
      container.querySelectorAll<HTMLInputElement>('input[type="file"]');
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
      await screen.findByText(
        "Excavator bucket crack repair",
        {},
        { timeout: 4000 },
      ),
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

    // Non-CNC job summary keeps location and photos.
    for (const line of [
      "MATERIAL · TBD",
      "TIMELINE · Flexible",
      "LOCATION · TBD",
      "PHOTOS · 0",
    ]) {
      expect(screen.getByText(line)).toBeInTheDocument();
    }
    expect(screen.queryByText(/FILES ·/)).toBeNull();

    // AI-draft disclaimers.
    expect(
      screen.getByText("AI draft — not a final quote"),
    ).toBeInTheDocument();
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
    await user.click(slots[0]!);
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
    expect(
      screen.getByRole("link", { name: "Back to the site" }),
    ).toHaveAttribute("href", "/");
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
      await screen.findByText(
        /An AI drafted these numbers/,
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Weld-out")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send the request" }),
    ).toBeDisabled();
    // A transport failure carries no customer-ready message, so the draft
    // stands in — but it is labelled as generic, not passed off as an AI
    // draft of this job.
    expect(
      screen.getByText(/We could not reach the estimator/),
    ).toBeInTheDocument();
  });

  describe("verification gating (issue #6)", () => {
    test("Run the estimate stays off until the check clears, and never sends a placeholder token", async () => {
      h.autoSolve = false;
      const user = userEvent.setup();
      render(<QuoteFlow />);
      await fillStep1(user);
      await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
      await user.type(screen.getByLabelText(/^Phone/), "8175550100");

      // Pending: the action is off and says why.
      const pending = screen.getByRole("button", {
        name: "Waiting on the check",
      });
      expect(pending).toBeDisabled();
      expect(
        screen.getByText(/Running a quick check that you are human/),
      ).toBeInTheDocument();
      await user.click(pending);
      expect(h.action).not.toHaveBeenCalled();
      expect(screen.getByText("Where do we send the numbers")).toBeVisible();

      // Token lands: the action turns on and the estimate carries the real
      // token, never the literal "dev".
      act(() => {
        h.solve();
      });
      expect(
        screen.getByText("Check cleared. Ready to run the estimate."),
      ).toBeInTheDocument();
      const run = screen.getByRole("button", { name: "Run the estimate" });
      expect(run).toBeEnabled();
      await user.click(run);

      expect(
        await screen.findByText(
          "AI draft — not a final quote",
          {},
          { timeout: 4000 },
        ),
      ).toBeInTheDocument();
      const estArgs = h.action.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(estArgs.turnstileToken).toBe("test-turnstile-token");
      expect(
        h.action.mock.calls.some(
          ([, args]) =>
            (args as Record<string, unknown>).turnstileToken === "dev",
        ),
      ).toBe(false);
    });
  });

  describe("server failures reach a screen (issue #6)", () => {
    /** Step 1 → 2 → 3 with the estimate settled. */
    async function toEstimate(user: ReturnType<typeof userEvent.setup>) {
      await fillStep1(user);
      await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
      await user.type(screen.getByLabelText(/^Phone/), "8175550100");
      await user.click(
        screen.getByRole("button", { name: "Run the estimate" }),
      );
      await screen.findByText(
        "AI draft — not a final quote",
        {},
        { timeout: 4000 },
      );
      await user.click(
        document.querySelectorAll<HTMLButtonElement>(".qf-slot")[0],
      );
    }

    test("a rejected submission never renders the confirmation screen", async () => {
      submitRejects(
        convexError("Slow down. Call Eric instead: (817) 894-6357."),
      );
      const user = userEvent.setup();
      render(<QuoteFlow />);
      await toEstimate(user);

      await user.click(
        screen.getByRole("button", { name: "Send the request" }),
      );

      // Still on step 3 with the backend's own words and a way out.
      expect(
        await screen.findByText(
          "Slow down. Call Eric instead: (817) 894-6357.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("Request sent.")).toBeNull();
      expect(screen.getByText("Pick a callback slot")).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Call Eric: (817) 894-6357" }),
      ).toHaveAttribute("href", "tel:8178946357");
      // Nothing persisted, so nothing goes in local history either.
      expect(store.get("tsws_quotes")).toBeUndefined();
      expect(
        screen.getByRole("button", { name: "Try sending again" }),
      ).toBeEnabled();
    });

    test("a message this build has never seen still shows verbatim", async () => {
      submitRejects(convexError("Shop closed for inventory. Try Monday."));
      const user = userEvent.setup();
      render(<QuoteFlow />);
      await toEstimate(user);

      await user.click(
        screen.getByRole("button", { name: "Send the request" }),
      );

      expect(
        await screen.findByText("Shop closed for inventory. Try Monday."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Request sent.")).toBeNull();
    });

    test("a transport failure on submit says nothing was saved, then a retry can land", async () => {
      submitRejects(new Error("network down"));
      const user = userEvent.setup();
      render(<QuoteFlow />);
      await toEstimate(user);

      await user.click(
        screen.getByRole("button", { name: "Send the request" }),
      );
      expect(
        await screen.findByText(/We could not send your request/),
      ).toBeInTheDocument();
      expect(screen.queryByText("Request sent.")).toBeNull();

      // The same request goes through on the retry.
      h.action.mockImplementation(async (_ref: unknown, args: object) =>
        "slot" in args ? { ok: true, requestId: "Q-2026-778" } : MOCK_ESTIMATE,
      );
      await user.click(
        screen.getByRole("button", { name: "Try sending again" }),
      );
      expect(await screen.findByText("Request sent.")).toBeInTheDocument();
      expect(screen.getByText(/Your reference is Q-2026-778/)).toBeVisible();
      expect(JSON.parse(store.get("tsws_quotes") ?? "[]")).toHaveLength(1);
    });

    test("a rejected estimate shows the reason instead of a draft, and retries", async () => {
      h.action.mockRejectedValueOnce(
        convexError("Verification failed. Reload the page and try again."),
      );
      const user = userEvent.setup();
      render(<QuoteFlow />);
      await fillStep1(user);
      await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
      await user.type(screen.getByLabelText(/^Phone/), "8175550100");
      await user.click(
        screen.getByRole("button", { name: "Run the estimate" }),
      );

      expect(
        await screen.findByText(
          "We could not draft the numbers",
          {},
          { timeout: 4000 },
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Verification failed. Reload the page and try again."),
      ).toBeInTheDocument();
      // No fake draft, and no way to send a request that would be rejected.
      expect(screen.queryByText("AI draft — not a final quote")).toBeNull();
      expect(screen.queryByText("Pick a callback slot")).toBeNull();
      expect(screen.getByRole("status")).toHaveTextContent(
        "We could not draft the numbers.",
      );

      await user.click(
        screen.getByRole("button", { name: "Try the estimate again" }),
      );
      expect(
        await screen.findByText(
          "AI draft — not a final quote",
          {},
          { timeout: 4000 },
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText("We could not draft the numbers")).toBeNull();
    });

    test("a rejection naming a field the form checks marks that field", async () => {
      h.action.mockRejectedValueOnce(
        convexError("Describe the job in a sentence or two."),
      );
      const user = userEvent.setup();
      render(<QuoteFlow />);
      await fillStep1(user);
      await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
      await user.type(screen.getByLabelText(/^Phone/), "8175550100");
      await user.click(
        screen.getByRole("button", { name: "Run the estimate" }),
      );
      expect(
        await screen.findByText(
          "Describe the job in a sentence or two.",
          {},
          { timeout: 4000 },
        ),
      ).toBeInTheDocument();

      // Back on the job step, the named field carries the message.
      await user.click(screen.getByRole("button", { name: "Edit the job" }));
      const desc = screen.getByLabelText(/What needs welding or building/);
      expect(desc).toHaveAttribute("aria-invalid", "true");
      expect(
        screen.getByText("Describe the job in a sentence or two."),
      ).toBeInTheDocument();
    });
  });

  describe("client-side checks mirror the server caps (issue #6)", () => {
    test("length-capped fields carry maxLength so the cap cannot be typed past", async () => {
      const user = userEvent.setup();
      render(<QuoteFlow />);
      const caps: [RegExp, number][] = [
        [/What needs welding or building/, 4000],
        [/Rough dimensions/, 500],
        [/Where the work sits/, 500],
        [/Quote you already got/, 100],
      ];
      for (const [label, max] of caps) {
        expect(screen.getByLabelText(label)).toHaveAttribute(
          "maxlength",
          String(max),
        );
      }

      await fillStep1(user);
      for (const [label, max] of [
        [/^Name/, 300],
        [/^Company/, 300],
        [/^Phone/, 100],
        [/^Email/, 300],
      ] as [RegExp, number][]) {
        expect(screen.getByLabelText(label)).toHaveAttribute(
          "maxlength",
          String(max),
        );
      }
    });

    test("a malformed email blocks the estimate instead of failing server-side", async () => {
      const user = userEvent.setup();
      render(<QuoteFlow />);
      await fillStep1(user);
      await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
      await user.type(screen.getByLabelText(/^Phone/), "8175550100");
      await user.type(screen.getByLabelText(/^Email/), "jane@company");

      await user.click(
        screen.getByRole("button", { name: "Run the estimate" }),
      );

      expect(
        screen.getByText("Enter a valid email or leave it blank."),
      ).toBeInTheDocument();
      expect(h.action).not.toHaveBeenCalled();
      expect(screen.getByLabelText(/^Email/)).toHaveFocus();

      // A valid address clears it and the estimate runs.
      await user.clear(screen.getByLabelText(/^Email/));
      await user.type(screen.getByLabelText(/^Email/), "jane@company.com");
      await user.click(
        screen.getByRole("button", { name: "Run the estimate" }),
      );
      expect(
        await screen.findByText(
          "AI draft — not a final quote",
          {},
          { timeout: 4000 },
        ),
      ).toBeInTheDocument();
    });

    test("an over-cap description is caught on the client", async () => {
      const user = userEvent.setup();
      render(<QuoteFlow />);
      await user.selectOptions(
        screen.getByLabelText(/^Job type/),
        "Pipe welding",
      );
      // maxLength keeps typing and pasting inside the cap, so drive the value
      // the way an autofill or a browser extension would: straight in.
      fireEvent.change(
        screen.getByLabelText(/What needs welding or building/),
        {
          target: { value: "x".repeat(4001) },
        },
      );
      await user.click(
        screen.getByRole("button", { name: "Send the details" }),
      );

      expect(
        screen.getByText("Keep this under 4,000 characters."),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Where do we send the numbers"),
      ).not.toBeInTheDocument();
    });
  });

  test("CNC plasma / signs gets the short form and the normal AI estimate", async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);

    // Typed under another job type, then hidden by the CNC form.
    await user.type(screen.getByLabelText(/Where the work sits/), "Tolar");
    await user.selectOptions(
      screen.getByLabelText(/^Job type/),
      "CNC plasma cutting / signs",
    );

    expect(screen.queryByLabelText(/Where the work sits/)).toBeNull();
    expect(screen.queryByLabelText(/Quote you already got/)).toBeNull();
    expect(screen.queryByText(/Competitor quote/)).toBeNull();
    const material = screen.getByLabelText(/^Material/);
    expect(
      Array.from(material.querySelectorAll("option"))
        .map((o) => o.textContent)
        .filter((t) => t !== "If you know it"),
    ).toEqual(["Carbon steel", "Stainless", "Aluminum"]);
    expect(
      screen.getByText("Drawing, DXF/CAD file or photo"),
    ).toBeInTheDocument();

    await user.selectOptions(material, "Stainless");
    await user.type(screen.getByLabelText(/^Thickness/), '1/4"');
    await user.type(
      screen.getByLabelText(/What do you need cut/),
      "Ranch entry sign with our brand in the middle.",
    );
    await user.type(screen.getByLabelText(/^Size/), "6 ft x 2 ft");
    await user.type(screen.getByLabelText(/^Quantity/), "2");
    await user.upload(
      screen.getByLabelText(/Drawing, DXF\/CAD file or photo/),
      new File(["0\nSECTION"], "sign.dxf", { type: "" }),
    );
    expect(screen.getByText("1 file(s): sign.dxf")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Send the details" }));
    await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
    await user.type(screen.getByLabelText(/^Phone/), "8175550100");
    await user.click(screen.getByRole("button", { name: "Run the estimate" }));

    expect(
      await screen.findByText("AI draft — not a final quote"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Total man-hours/)).toBeInTheDocument();
    // The job summary follows the CNC form: no location, files not photos.
    expect(screen.getByText("MATERIAL · Stainless")).toBeInTheDocument();
    expect(screen.getByText('THICKNESS · 1/4"')).toBeInTheDocument();
    expect(screen.getByText("QUANTITY · 2")).toBeInTheDocument();
    expect(screen.getByText("FILES · 1")).toBeInTheDocument();
    expect(screen.queryByText(/LOCATION ·/)).toBeNull();
    expect(screen.queryByText(/PHOTOS ·/)).toBeNull();
    const estimateArgs = h.action.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(estimateArgs).toMatchObject({
      type: "CNC plasma cutting / signs",
      material: "Stainless",
      thickness: '1/4"',
      dims: "6 ft x 2 ft",
      quantity: "2",
    });
    expect(estimateArgs.location).toBeUndefined();

    await user.click(
      document.querySelectorAll<HTMLButtonElement>(".qf-slot")[0]!,
    );
    await user.click(screen.getByRole("button", { name: "Send the request" }));
    expect(await screen.findByText("Request sent.")).toBeInTheDocument();
    const submitArgs = h.action.mock.calls[1]?.[1] as {
      job: Record<string, unknown>;
      estimate: unknown;
    };
    expect(submitArgs.job).toMatchObject({
      type: "CNC plasma cutting / signs",
      thickness: '1/4"',
      quantity: "2",
    });
    expect(submitArgs.job.location).toBeUndefined();
    expect(submitArgs.estimate).toEqual(MOCK_ESTIMATE);
    // The drawing went to storage and rides along by id, not by name.
    expect(h.mutation).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://upload.test/1",
      expect.objectContaining({ method: "POST" }),
    );
    expect(submitArgs).toMatchObject({
      files: [{ storageId: "stor-1", name: "sign.dxf" }],
    });
    expect(submitArgs.job.photoNames).toBeUndefined();
  });

  test("a .dxf is refused for a non-CNC job, and so is an oversized photo", async () => {
    // Skip the accept-attribute filter so the form's own check is exercised.
    const user = userEvent.setup({ applyAccept: false });
    render(<QuoteFlow />);
    await user.selectOptions(
      screen.getByLabelText(/^Job type/),
      "Pipe welding",
    );
    const input = screen.getByLabelText(/Photos of the job/);
    expect(input).toHaveAttribute("accept", "image/*");

    await user.upload(input, new File(["0"], "sign.dxf", { type: "" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "sign.dxf is not a file type this job takes.",
    );
    expect(screen.queryByText(/sign\.dxf$/)).toBeNull();

    const big = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    await user.upload(input, big);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "big.jpg is over 10 MB.",
    );
  });

  test("switching away from CNC removes CAD files with a notice and keeps photos", async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    await user.selectOptions(screen.getByLabelText(/^Job type/), CNC);
    await user.upload(
      screen.getByLabelText(/Drawing, DXF\/CAD file or photo/),
      [
        new File(["0\nSECTION"], "test-bracket.dxf", { type: "" }),
        new File(["x"], "bracket.jpg", { type: "image/jpeg" }),
      ],
    );
    expect(
      screen.getByText("2 file(s): test-bracket.dxf, bracket.jpg"),
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/^Job type/),
      "Fabrication (new build)",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Removed test-bracket.dxf. Fabrication jobs take photos only.",
    );
    expect(screen.getByText("1 file(s): bracket.jpg")).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/What needs welding or building/),
      "Steel bracket.",
    );
    await user.click(screen.getByRole("button", { name: "Send the details" }));
    await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
    await user.type(screen.getByLabelText(/^Phone/), "8175550100");
    await user.click(screen.getByRole("button", { name: "Run the estimate" }));
    expect(
      await screen.findByText("AI draft — not a final quote"),
    ).toBeInTheDocument();
    expect(screen.getByText("PHOTOS · 1")).toBeInTheDocument();

    await user.click(
      document.querySelectorAll<HTMLButtonElement>(".qf-slot")[0]!,
    );
    await user.click(screen.getByRole("button", { name: "Send the request" }));
    expect(await screen.findByText("Request sent.")).toBeInTheDocument();
    const submitArgs = h.action.mock.calls[1]?.[1] as {
      job: Record<string, unknown>;
      files: unknown;
    };
    expect(h.mutation).toHaveBeenCalledTimes(1);
    expect(submitArgs.files).toEqual([
      { storageId: "stor-1", name: "bracket.jpg" },
    ]);
    expect(submitArgs.job.photoNames).toBeUndefined();
  });

  test("switching away from CNC with only a .dxf leaves no files", async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    await user.selectOptions(screen.getByLabelText(/^Job type/), CNC);
    await user.upload(
      screen.getByLabelText(/Drawing, DXF\/CAD file or photo/),
      new File(["0\nSECTION"], "test-bracket.dxf", { type: "" }),
    );
    await user.selectOptions(
      screen.getByLabelText(/^Job type/),
      "Fabrication (new build)",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Removed test-bracket.dxf. Fabrication jobs take photos only.",
    );
    expect(screen.queryByText(/test-bracket\.dxf$/)).toBeNull();

    await user.type(
      screen.getByLabelText(/What needs welding or building/),
      "Steel bracket.",
    );
    await user.click(screen.getByRole("button", { name: "Send the details" }));
    await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
    await user.type(screen.getByLabelText(/^Phone/), "8175550100");
    await user.click(screen.getByRole("button", { name: "Run the estimate" }));
    expect(
      await screen.findByText("AI draft — not a final quote"),
    ).toBeInTheDocument();
    expect(screen.getByText("PHOTOS · 0")).toBeInTheDocument();

    await user.click(
      document.querySelectorAll<HTMLButtonElement>(".qf-slot")[0]!,
    );
    await user.click(screen.getByRole("button", { name: "Send the request" }));
    expect(await screen.findByText("Request sent.")).toBeInTheDocument();
    const submitArgs = h.action.mock.calls[1]?.[1] as {
      job: Record<string, unknown>;
      files: unknown;
    };
    expect(h.mutation).not.toHaveBeenCalled();
    expect(submitArgs.files).toBeUndefined();
    expect(submitArgs.job.photoNames).toBeUndefined();
  });

  async function finishAndSubmit(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Send the details" }));
    await user.type(screen.getByLabelText(/^Name/), "Jane Rig");
    await user.type(screen.getByLabelText(/^Phone/), "8175550100");
    await user.click(screen.getByRole("button", { name: "Run the estimate" }));
    await screen.findByText("AI draft — not a final quote");
    await user.click(
      document.querySelectorAll<HTMLButtonElement>(".qf-slot")[0]!,
    );
    await user.click(screen.getByRole("button", { name: "Send the request" }));
    expect(await screen.findByText("Request sent.")).toBeInTheDocument();
    return h.action.mock.calls[1]?.[1] as {
      job: Record<string, unknown>;
      files: unknown;
    };
  }

  test("the competitor quote uploads to storage and goes in marked as competitor", async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ storageId: "stor-photo" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ storageId: "stor-bid" }),
      });
    await fillStep1Fields(user);
    await user.upload(
      screen.getByLabelText(/Photos of the job/),
      new File(["x"], "gate.jpg", { type: "image/jpeg" }),
    );
    const comp = screen.getByLabelText(/Competitor quote/);
    expect(comp).toHaveAttribute("accept", "image/*,.pdf");
    await user.upload(
      comp,
      new File(["%PDF"], "bid.pdf", { type: "application/pdf" }),
    );
    expect(screen.getByText("bid.pdf")).toBeInTheDocument();

    const submitArgs = await finishAndSubmit(user);
    expect(h.mutation).toHaveBeenCalledTimes(2);
    expect(submitArgs.files).toEqual([
      { storageId: "stor-photo", name: "gate.jpg" },
      { storageId: "stor-bid", name: "bid.pdf", kind: "competitor" },
    ]);
    expect(submitArgs.job.photoNames).toBeUndefined();
  });

  test("a .dxf is refused in the competitor slot", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<QuoteFlow />);
    await user.upload(
      screen.getByLabelText(/Competitor quote/),
      new File(["0"], "bid.dxf", { type: "" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "bid.dxf is not a photo or PDF.",
    );
    expect(
      screen.getByText("Tap to attach the other shop's quote."),
    ).toBeInTheDocument();
  });

  test("the competitor quote is not sent once the job type is CNC", async () => {
    const user = userEvent.setup();
    render(<QuoteFlow />);
    await user.selectOptions(
      screen.getByLabelText(/^Job type/),
      "Pipe welding",
    );
    await user.upload(
      screen.getByLabelText(/Competitor quote/),
      new File(["%PDF"], "bid.pdf", { type: "application/pdf" }),
    );
    await user.selectOptions(screen.getByLabelText(/^Job type/), CNC);
    expect(screen.queryByText(/Competitor quote/)).toBeNull();
    await user.type(
      screen.getByLabelText(/What do you need cut/),
      "Ranch sign.",
    );

    const submitArgs = await finishAndSubmit(user);
    expect(h.mutation).not.toHaveBeenCalled();
    expect(submitArgs.files).toBeUndefined();
    expect(submitArgs.job.photoNames).toBeUndefined();
    expect(submitArgs.job.compQuote).toBeUndefined();
  });

  test("other job types keep the full form without CNC fields", () => {
    render(<QuoteFlow />);
    expect(screen.getByLabelText(/Where the work sits/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Quote you already got/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/What needs welding or building/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Thickness/)).toBeNull();
    expect(screen.queryByLabelText(/^Quantity/)).toBeNull();
  });
});
