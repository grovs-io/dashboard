import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useScaleUpDialog } from "../useScaleUpDialog";

const dialogProps = vi.hoisted(() => ({ last: {} as Record<string, unknown> }));

vi.mock("@/components/settings/ScaleUpDialog", () => ({
  __esModule: true,
  default: (props: { open: boolean }) => {
    dialogProps.last = props;
    return props.open ? <div data-testid="scale-up-dialog" /> : null;
  },
}));

describe("useScaleUpDialog", () => {
  it("opens the dialog with only open/onOpenChange", () => {
    const { result } = renderHook(() => useScaleUpDialog());
    act(() => result.current.openScaleUp());
    render(<>{result.current.scaleUpDialog}</>);
    expect(screen.getByTestId("scale-up-dialog")).toBeInTheDocument();
    expect(Object.keys(dialogProps.last).sort()).toEqual([
      "onOpenChange",
      "open",
    ]);
  });
});
