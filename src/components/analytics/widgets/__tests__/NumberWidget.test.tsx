import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NumberWidget } from "../NumberWidget";

describe("NumberWidget", () => {
  it("shows the total and the delta vs previous", () => {
    render(
      <NumberWidget
        data={{
          metric: "installs",
          group_by: null,
          rows: [],
          other: null,
          total: { value: 1234, previous: 1000 },
        }}
      />
    );
    expect(screen.getByText("1.234")).toBeInTheDocument();
    expect(screen.getByText("23%")).toBeInTheDocument();
  });

  it("hides the delta without a previous value", () => {
    render(
      <NumberWidget
        data={{
          metric: "installs",
          group_by: null,
          rows: [],
          other: null,
          total: { value: 5 },
        }}
      />
    );
    expect(screen.queryByText("%")).toBeNull();
  });
});
