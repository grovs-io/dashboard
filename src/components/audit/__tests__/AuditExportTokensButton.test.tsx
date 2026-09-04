import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/components/audit/AuditExportTokensSheet", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div>export-tokens-sheet</div> : null,
}));

import AuditExportTokensButton from "../AuditExportTokensButton";

describe("AuditExportTokensButton", () => {
  it("opens the tokens sheet when clicked", () => {
    render(<AuditExportTokensButton instanceId="i1" />);
    expect(screen.queryByText("export-tokens-sheet")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Export tokens"));
    expect(screen.getByText("export-tokens-sheet")).toBeInTheDocument();
  });
});
