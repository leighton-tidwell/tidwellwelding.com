"use client";

import { useCallback, useRef, useState } from "react";
import { Button, Icon } from "@/components/ds";

export type DownloadPdfButtonProps = {
  /** Builds the PDF and resolves with a URL to fetch it from. */
  generate: () => Promise<string>;
  /** Filename the browser should save as, e.g. "TSWS-082626.pdf". */
  filename: string;
  label?: string;
};

type Phase = "idle" | "working" | "ready" | "failed";

/**
 * Generating an invoice PDF is a server round trip that takes a moment. Without
 * a busy state an impatient triple-tap fires three generations and three
 * downloads, so the in-flight guard here is a correctness feature, not polish:
 * the ref blocks re-entry synchronously, before React has re-rendered.
 */
export default function DownloadPdfButton({
  generate,
  filename,
  label = "Download PDF",
}: DownloadPdfButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const inFlight = useRef(false);

  const handleClick = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase("working");

    try {
      const url = await generate();

      // The storage URL is cross-origin, and a cross-origin href makes the
      // browser IGNORE the download attribute — the file lands as a UUID.
      // Fetching the bytes and handing over a same-origin blob URL keeps the
      // invoice number as the filename.
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetching the PDF failed: ${response.status}`);
      const blobUrl = URL.createObjectURL(await response.blob());

      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      // Release the object URL once the download has been handed off.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);

      setPhase("ready");
    } catch {
      setPhase("failed");
    } finally {
      inFlight.current = false;
    }
  }, [generate, filename]);

  const working = phase === "working";

  return (
    <div className="admin-download">
      <Button
        onClick={handleClick}
        disabled={working}
        ariaBusy={working}
      >
        {working ? (
          <>
            <span className="admin-spinner" aria-hidden="true" /> Building the PDF…
          </>
        ) : (
          <>
            <Icon name="file-text" /> {label}
          </>
        )}
      </Button>

      {/* Progress for screen readers. Polite so it never interrupts typing. */}
      <span role="status" aria-live="polite" className="admin-sr-only">
        {phase === "working" ? "Building the PDF" : null}
        {phase === "ready" ? "Your invoice PDF is ready and downloading" : null}
      </span>

      {phase === "failed" ? (
        <p role="alert" className="admin-gate__error">
          We could not build that PDF. Check your connection and try again.
        </p>
      ) : null}
    </div>
  );
}
