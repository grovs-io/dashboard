import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProjectIcon } from "../project-icon";

describe("ProjectIcon", () => {
  it("shows the app's store icon when the project has one", () => {
    const { container } = render(
      <ProjectIcon url="https://cdn.example/icon.png" />
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/icon.png"
    );
    expect(
      screen.queryByTestId("project-icon-fallback")
    ).not.toBeInTheDocument();
  });

  it("falls back to the project's first letter without an app icon", () => {
    render(<ProjectIcon url={null} name="grovs-events-stream" />);
    expect(screen.getByTestId("project-icon-fallback")).toHaveTextContent(
      /^G$/
    );
  });

  it("uses the first character of any script, and a dash without a name", () => {
    const { rerender } = render(<ProjectIcon name="  インスタンス テスト" />);
    expect(screen.getByTestId("project-icon-fallback")).toHaveTextContent(
      /^イ$/
    );
    rerender(<ProjectIcon name="" />);
    expect(screen.getByTestId("project-icon-fallback")).toHaveTextContent(
      /^–$/
    );
  });

  it("falls back when the image does not load", () => {
    const { container } = render(
      <ProjectIcon url="https://cdn.example/broken.png" />
    );
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByTestId("project-icon-fallback")).toBeInTheDocument();
  });
});
