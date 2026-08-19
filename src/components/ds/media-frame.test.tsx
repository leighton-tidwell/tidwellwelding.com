import { cleanup, render, screen } from "@testing-library/react";
import {
  afterEach,
  describe,
  expect,
  test,
} from "vitest";
import MediaFrame from "@/components/ds/media-frame";

afterEach(cleanup);

describe("MediaFrame", () => {
  test("src mode renders an img with alt and no placeholder", () => {
    const { container } = render(
      <MediaFrame src="/work/rail.jpg" alt="Handrail run" />,
    );
    const img = screen.getByAltText("Handrail run");
    expect(img).toHaveClass("tsws-media__img");
    expect(img).toHaveAttribute("src", "/work/rail.jpg");
    expect(container.querySelector(".tsws-media__ph")).not.toBeInTheDocument();
  });

  test("placeholder mode renders kicker and label, no img", () => {
    const { container } = render(
      <MediaFrame kicker="Photo needed" label="Wide shot of the shop bay" />,
    );
    expect(screen.getByText("Photo needed")).toHaveClass(
      "tsws-media__ph-kicker",
    );
    expect(screen.getByText("Wide shot of the shop bay")).toHaveClass(
      "tsws-media__ph-label",
    );
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  test("children override both src and placeholder", () => {
    const { container } = render(
      <MediaFrame src="/ignored.jpg" label="ignored">
        <video data-testid="vid" />
      </MediaFrame>,
    );
    expect(screen.getByTestId("vid")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.queryByText("ignored")).not.toBeInTheDocument();
  });

  test("ratio prop sets aspect-ratio on the frame", () => {
    const { container } = render(<MediaFrame ratio="16 / 9" label="x" />);
    expect(container.querySelector(".tsws-media")).toHaveStyle({
      aspectRatio: "16 / 9",
    });
  });

  test("scrim renders the readability overlay", () => {
    const { container } = render(<MediaFrame src="/a.jpg" scrim />);
    const scrim = container.querySelector(".tsws-media__scrim");
    expect(scrim).toBeInTheDocument();
    expect(scrim).toHaveAttribute("aria-hidden", "true");
  });

  test("no scrim by default", () => {
    const { container } = render(<MediaFrame src="/a.jpg" />);
    expect(container.querySelector(".tsws-media__scrim")).not.toBeInTheDocument();
  });
});
