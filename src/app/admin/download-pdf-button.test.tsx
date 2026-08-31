import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import DownloadPdfButton from "./download-pdf-button";

afterEach(cleanup);

/** A generate call that resolves only when we let it, so the in-flight state
 * can be observed rather than raced. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("DownloadPdfButton — preventing repeat clicks", () => {
  test("a second and third click while generating do not start more work", async () => {
    const gate = deferred<string>();
    const generate = vi.fn(() => gate.promise);
    const user = userEvent.setup();
    render(<DownloadPdfButton generate={generate} filename="INV-1.pdf" />);

    const button = screen.getByRole("button");
    await user.click(button);
    await user.click(button);
    await user.click(button);

    // The impatient triple-tap must produce exactly one generation.
    expect(generate).toHaveBeenCalledTimes(1);

    gate.resolve("blob:fake-url");
    await waitFor(() => expect(button).toBeEnabled());
  });

  test("the button is disabled while the PDF is being built", async () => {
    const gate = deferred<string>();
    const user = userEvent.setup();
    render(
      <DownloadPdfButton generate={() => gate.promise} filename="INV-1.pdf" />,
    );

    const button = screen.getByRole("button");
    expect(button).toBeEnabled();

    await user.click(button);
    expect(button).toBeDisabled();

    gate.resolve("blob:fake-url");
    await waitFor(() => expect(button).toBeEnabled());
  });

  test("a fresh download is possible once the first one finishes", async () => {
    const generate = vi.fn(() => Promise.resolve("blob:fake-url"));
    const user = userEvent.setup();
    render(<DownloadPdfButton generate={generate} filename="INV-1.pdf" />);

    const button = screen.getByRole("button");
    await user.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    await waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
  });
});

describe("DownloadPdfButton — telling the owner what is happening", () => {
  test("shows building copy and a spinner while it works", async () => {
    const gate = deferred<string>();
    const user = userEvent.setup();
    render(
      <DownloadPdfButton generate={() => gate.promise} filename="INV-1.pdf" />,
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent(/building/i);
    expect(document.querySelector(".admin-spinner")).not.toBeNull();

    gate.resolve("blob:fake-url");
    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveTextContent(/download/i),
    );
  });

  test("announces progress politely for screen readers", async () => {
    const gate = deferred<string>();
    const user = userEvent.setup();
    render(
      <DownloadPdfButton generate={() => gate.promise} filename="INV-1.pdf" />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    await user.click(screen.getByRole("button"));
    expect(status).toHaveTextContent(/building/i);

    gate.resolve("blob:fake-url");
    await waitFor(() => expect(status).toHaveTextContent(/ready/i));
  });

  test("the busy state is exposed to assistive tech, not just visually", async () => {
    const gate = deferred<string>();
    const user = userEvent.setup();
    render(
      <DownloadPdfButton generate={() => gate.promise} filename="INV-1.pdf" />,
    );

    const button = screen.getByRole("button");
    await user.click(button);
    expect(button).toHaveAttribute("aria-busy", "true");

    gate.resolve("blob:fake-url");
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "false"));
  });
});

describe("DownloadPdfButton — when generating fails", () => {
  test("surfaces the failure and lets the owner try again", async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("network died"))
      .mockResolvedValueOnce("blob:fake-url");
    const user = userEvent.setup();
    render(<DownloadPdfButton generate={generate} filename="INV-1.pdf" />);

    const button = screen.getByRole("button");
    await user.click(button);

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/could not/i),
    );
    // The button must come back, or a transient failure strands him.
    expect(button).toBeEnabled();

    await user.click(button);
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
  });

  test("a failure clears the busy state so the UI is not stuck spinning", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<DownloadPdfButton generate={generate} filename="INV-1.pdf" />);

    const button = screen.getByRole("button");
    await user.click(button);

    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "false"));
    expect(document.querySelector(".admin-spinner")).toBeNull();
  });
});

describe("DownloadPdfButton — delivering the file", () => {
  test("triggers a download using the invoice's filename", async () => {
    const clicks: string[] = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === "a") {
        el.click = () => clicks.push((el as HTMLAnchorElement).download);
      }
      return el;
    });

    const user = userEvent.setup();
    render(
      <DownloadPdfButton
        generate={() => Promise.resolve("blob:fake-url")}
        filename="TSWS-082626.pdf"
      />,
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => expect(clicks).toEqual(["TSWS-082626.pdf"]));
    vi.restoreAllMocks();
  });
});
