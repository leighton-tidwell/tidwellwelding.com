import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import QuoteDetail, {
  formatFileSize,
  type QuoteDetailData,
  type QuoteLinkActions,
} from "./quote-detail";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const BASE: QuoteDetailData = {
  requestId: "Q-2026-101",
  name: "Marisol Serrano",
  phone: "(817) 555-0142",
  job: {
    type: "Gate / fence",
    desc: "Ranch gate, 16 ft, with a walk-through",
  },
  files: [],
  estimate: null,
  slot: "Thursday morning",
  status: "new",
  createdAt: Date.UTC(2026, 9, 14, 15, 0),
  customer: null,
  invoice: null,
};

function quote(overrides: Partial<QuoteDetailData> = {}): QuoteDetailData {
  return { ...BASE, ...overrides };
}

describe("QuoteDetail — a quote with nothing attached", () => {
  test("renders without error and says plainly that no files came in", () => {
    render(<QuoteDetail quote={quote()} onBack={() => {}} />);

    expect(screen.getByText("Q-2026-101")).toBeInTheDocument();
    expect(screen.getByText(/no photos or drawings/i)).toBeInTheDocument();
    // An empty file list must not produce a download control at all.
    expect(
      screen.queryByRole("button", { name: /download/i }),
    ).not.toBeInTheDocument();
  });

  test("a pre-#17 quote explains where its listed photos went", () => {
    render(
      <QuoteDetail
        quote={quote({ job: { ...BASE.job, photoNames: ["gate.jpg"] } })}
        onBack={() => {}}
      />,
    );

    // The names were recorded, the blobs never were. Saying so beats an empty
    // box that reads like a bug.
    expect(screen.getByText(/gate\.jpg/)).toBeInTheDocument();
    expect(
      screen.getByText(/before the site kept uploaded files/i),
    ).toBeInTheDocument();
  });

  test("a quote with no AI draft says so instead of showing an empty estimate", () => {
    render(<QuoteDetail quote={quote()} onBack={() => {}} />);
    expect(screen.getByText(/no ai draft was saved/i)).toBeInTheDocument();
  });
});

describe("QuoteDetail — the job and the contact", () => {
  test("shows the customer's own description and the callback slot", () => {
    render(<QuoteDetail quote={quote()} onBack={() => {}} />);

    expect(
      screen.getByText("Ranch gate, 16 ft, with a walk-through"),
    ).toBeInTheDocument();
    expect(screen.getByText("Thursday morning")).toBeInTheDocument();
  });

  test("only the job details that were filled in get a row", () => {
    render(
      <QuoteDetail
        quote={quote({
          job: { ...BASE.job, material: "A36", thickness: "   " },
        })}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText("Material")).toBeInTheDocument();
    // A blank answer is left out rather than printed as an empty row.
    expect(screen.queryByText("Thickness")).not.toBeInTheDocument();
  });

  test("the phone number is a tap-to-call link, and email only appears when given", () => {
    const { rerender } = render(
      <QuoteDetail quote={quote()} onBack={() => {}} />,
    );

    expect(screen.getByRole("link", { name: /call/i })).toHaveAttribute(
      "href",
      "tel:8175550142",
    );
    expect(
      screen.queryByRole("link", { name: /email back/i }),
    ).not.toBeInTheDocument();

    rerender(
      <QuoteDetail
        quote={quote({ email: "m@serrano.example" })}
        onBack={() => {}}
      />,
    );
    expect(screen.getByRole("link", { name: /email back/i })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:m@serrano.example"),
    );
  });
});

describe("QuoteDetail — the draft estimate", () => {
  test("shows the dollar range, hours and confidence", () => {
    render(
      <QuoteDetail
        quote={quote({
          estimate: {
            title: "16 ft ranch gate",
            summary: "Fabricate and hang it.",
            lineItems: [{ task: "Fabricate frame", crew: 2, hours: 8 }],
            hoursLow: 8,
            hoursHigh: 12,
            dollarsLow: 1200,
            dollarsHigh: 1800,
            confidence: "medium",
            questions: ["Is there power at the site?"],
          },
        })}
        onBack={() => {}}
      />,
    );

    expect(
      screen.getByText(/\$1,200\.00\s*–\s*\$1,800\.00/),
    ).toBeInTheDocument();
    expect(screen.getByText(/8–12 hours/)).toBeInTheDocument();
    expect(screen.getByText(/medium confidence/i)).toBeInTheDocument();
    expect(screen.getByText("Fabricate frame")).toBeInTheDocument();
    // Crew above one is worth seeing: it doubles the hours actually spent.
    expect(screen.getByText(/8 hr × 2/)).toBeInTheDocument();
    expect(screen.getByText("Is there power at the site?")).toBeInTheDocument();
  });
});

describe("QuoteDetail — attachments", () => {
  const FILES: QuoteDetailData["files"] = [
    {
      name: "gate.jpg",
      contentType: "image/jpeg",
      size: 2_400_000,
      competitor: false,
      url: "https://storage.example/gate",
    },
    {
      name: "other-shop.pdf",
      contentType: "application/pdf",
      size: 51_200,
      competitor: true,
      url: "https://storage.example/bid",
    },
  ];

  test("every upload gets its own download control", () => {
    render(<QuoteDetail quote={quote({ files: FILES })} onBack={() => {}} />);

    expect(screen.getAllByRole("button", { name: /download/i })).toHaveLength(
      2,
    );
    expect(screen.getByText(/gate\.jpg/)).toBeInTheDocument();
    expect(screen.getByText(/2\.3 MB/)).toBeInTheDocument();
    expect(screen.getByText(/competitor quote/i)).toBeInTheDocument();
  });

  test("a file whose blob is gone says so instead of offering a dead link", () => {
    render(
      <QuoteDetail
        quote={quote({ files: [{ ...FILES[0]!, url: null }] })}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText(/no longer in storage/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /download/i }),
    ).not.toBeInTheDocument();
  });
});

describe("formatFileSize", () => {
  test("reads in the unit a person would use", () => {
    expect(formatFileSize(800)).toBe("800 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(2_400_000)).toBe("2.3 MB");
  });
});

describe("QuoteDetail — turning a request into work", () => {
  /** Every handler stubbed, so a test can assert on the one it cares about and
   * know an unexpected click would have shown up on another. */
  function actions(overrides: Partial<QuoteLinkActions> = {}) {
    return {
      onCreateCustomer: vi.fn(),
      onCreateInvoice: vi.fn(),
      onOpenCustomer: vi.fn(),
      onOpenInvoice: vi.fn(),
      onLinkExistingCustomer: vi.fn(),
      onCreateSeparateCustomer: vi.fn(),
      ...overrides,
    };
  }

  test("an unlinked quote offers the customer step and holds the invoice back", async () => {
    const acts = actions();
    render(<QuoteDetail quote={quote()} onBack={() => {}} actions={acts} />);
    const user = userEvent.setup();

    expect(screen.getByText("Not saved yet")).toBeInTheDocument();
    expect(screen.getByText("None raised yet")).toBeInTheDocument();

    // An invoice needs somebody to bill, so the button is there but inert.
    const invoiceButton = screen.getByRole("button", {
      name: /create invoice/i,
    });
    expect(invoiceButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /save as customer/i }));
    expect(acts.onCreateCustomer).toHaveBeenCalledTimes(1);
    expect(acts.onCreateInvoice).not.toHaveBeenCalled();
  });

  test("a saved customer unlocks the invoice step", async () => {
    const acts = actions();
    render(
      <QuoteDetail
        quote={quote({ customer: { _id: "c1", name: "Serrano Builds" } })}
        onBack={() => {}}
        actions={acts}
      />,
    );
    const user = userEvent.setup();

    // The customer step is done, so it is no longer offered.
    expect(
      screen.queryByRole("button", { name: /save as customer/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /create invoice/i }));
    expect(acts.onCreateInvoice).toHaveBeenCalledTimes(1);
  });

  test("once both exist, the names link through instead of offering the steps again", async () => {
    const acts = actions();
    render(
      <QuoteDetail
        quote={quote({
          customer: { _id: "c1", name: "Serrano Builds" },
          invoice: { _id: "i1", number: "TSWS-101426", status: "draft" },
        })}
        onBack={() => {}}
        actions={acts}
      />,
    );
    const user = userEvent.setup();

    expect(
      screen.queryByRole("button", { name: /create invoice/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Serrano Builds" }));
    expect(acts.onOpenCustomer).toHaveBeenCalledWith("c1");
    await user.click(screen.getByRole("button", { name: "TSWS-101426" }));
    expect(acts.onOpenInvoice).toHaveBeenCalledWith("i1");
  });

  test("a name already in the book asks which it is rather than choosing", async () => {
    const acts = actions();
    render(
      <QuoteDetail
        quote={quote()}
        onBack={() => {}}
        actions={{
          ...acts,
          nameConflict: { customerId: "c9", customerName: "Marisol Serrano" },
        }}
      />,
    );
    const user = userEvent.setup();

    expect(screen.getByText(/already saved/i)).toBeInTheDocument();
    // The plain "save" button is replaced by the two answers, so there is no
    // way to resolve this by accident.
    expect(
      screen.queryByRole("button", { name: /^save as customer$/i }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /same person/i }));
    expect(acts.onLinkExistingCustomer).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: /separate one/i }));
    expect(acts.onCreateSeparateCustomer).toHaveBeenCalledTimes(1);
  });

  test("a mutation in flight disables the buttons, and a failure is said out loud", () => {
    render(
      <QuoteDetail
        quote={quote()}
        onBack={() => {}}
        actions={{ ...actions(), busy: true, error: "Could not save that." }}
      />,
    );

    expect(
      screen.getByRole("button", { name: /save as customer/i }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save that.");
  });

  test("with no handlers wired the card still reports what the quote became", () => {
    render(
      <QuoteDetail
        quote={quote({
          customer: { _id: "c1", name: "Serrano Builds" },
          invoice: { _id: "i1", number: "TSWS-101426", status: "draft" },
        })}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText("Serrano Builds")).toBeInTheDocument();
    expect(screen.getByText("TSWS-101426")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create invoice/i }),
    ).not.toBeInTheDocument();
  });
});
