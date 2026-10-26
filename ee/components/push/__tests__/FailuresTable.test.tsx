import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import FailuresTable from "../FailuresTable";

describe("FailuresTable", () => {
  it("labels known APNs reasons and FCM status codes, sorted by count descending", () => {
    render(
      <FailuresTable
        errorCounts={{ Unregistered: 480, "404": 35, BadDeviceToken: 12 }}
      />
    );
    expect(
      screen.getByText("Device uninstalled or token expired")
    ).toBeInTheDocument();
    expect(
      screen.getByText("FCM 404: Device not registered")
    ).toBeInTheDocument();
    expect(screen.getByText("480")).toBeInTheDocument();

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Device uninstalled or token expired");
    expect(rows[2]).toHaveTextContent("12");
    expect(screen.getByText("527 failed")).toBeInTheDocument();
  });

  it("labels no_app with a setup hint, and no_token", () => {
    render(<FailuresTable errorCounts={{ no_app: 7, no_token: 2 }} />);
    expect(
      screen.getByText("Push not configured for this platform")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Add the push credentials in iOS setup or Android setup."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Device has no push token")).toBeInTheDocument();
  });

  it("shows an empty message when there are no failures", () => {
    render(<FailuresTable errorCounts={{}} />);
    expect(screen.getByText("No delivery failures")).toBeInTheDocument();
  });
});
