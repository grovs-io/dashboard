import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardEmptyState } from "../DashboardEmptyState";
import { WIDGET_TEMPLATES } from "../widgetTemplates";

describe("DashboardEmptyState", () => {
  it("renders the primary CTA and all six templates", () => {
    render(
      <DashboardEmptyState
        onAddWidget={() => {}}
        onUseTemplate={async () => {}}
        pending={false}
      />
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add widget" })
    ).toBeInTheDocument();

    const addButtons = screen.getAllByRole("button", { name: /^Add / });
    expect(addButtons).toHaveLength(WIDGET_TEMPLATES.length + 1);

    for (const t of WIDGET_TEMPLATES) {
      expect(
        screen.getByRole("button", { name: `Add ${t.title}` })
      ).toBeInTheDocument();
    }
  });

  it("calls onUseTemplate with the exact template payload when a card is clicked", async () => {
    const onUseTemplate = vi.fn().mockResolvedValue(undefined);
    render(
      <DashboardEmptyState
        onAddWidget={() => {}}
        onUseTemplate={onUseTemplate}
        pending={false}
      />
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Add Installs by country" })
    );
    expect(onUseTemplate).toHaveBeenCalledTimes(1);
    expect(onUseTemplate).toHaveBeenCalledWith(WIDGET_TEMPLATES[0]!.payload);
  });

  it("calls onAddWidget when the primary button is clicked", async () => {
    const onAddWidget = vi.fn();
    render(
      <DashboardEmptyState
        onAddWidget={onAddWidget}
        onUseTemplate={async () => {}}
        pending={false}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Add widget" }));
    expect(onAddWidget).toHaveBeenCalledTimes(1);
  });

  it("disables every template button while pending", () => {
    render(
      <DashboardEmptyState
        onAddWidget={() => {}}
        onUseTemplate={async () => {}}
        pending={true}
      />
    );
    for (const t of WIDGET_TEMPLATES) {
      expect(
        screen.getByRole("button", { name: `Add ${t.title}` })
      ).toBeDisabled();
    }
  });

  it("templates are metric widgets", () => {
    expect(
      WIDGET_TEMPLATES.every(
        (t) => t.payload.kind === "metric" && t.payload.panel === null
      )
    ).toBe(true);
  });
});
