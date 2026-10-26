import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AudienceDetailsAttributes from "../AudienceDetailsAttributes";
import type { Visitor } from "@/types";

const visitor = { uuid: "v-1", sdk_identifier: "user_1" } as Visitor;
const renderWith = (
  push?: Parameters<typeof AudienceDetailsAttributes>[0]["push"]
) =>
  render(
    <AudienceDetailsAttributes
      visitorInfo={visitor}
      dataTable={[]}
      push={push}
    />
  );

describe("AudienceDetailsAttributes push status", () => {
  it("shows a registered mobile device", () => {
    renderWith({ platform: "ios", registered: true });
    expect(screen.getByText("Push notifications")).toBeInTheDocument();
    expect(screen.getByText("iOS")).toBeInTheDocument();
    expect(screen.getByText("Registered")).toBeInTheDocument();
  });

  it("shows a mobile device without a push token", () => {
    renderWith({ platform: "android", registered: false });
    expect(screen.getByText("Not registered")).toBeInTheDocument();
  });

  it("says push isn't available on web", () => {
    renderWith({ platform: "web", registered: false });
    expect(screen.getByText("Not available")).toBeInTheDocument();
  });

  it("hides the field when the backend doesn't send it", () => {
    renderWith(undefined);
    expect(screen.queryByText("Push notifications")).not.toBeInTheDocument();
  });
});
