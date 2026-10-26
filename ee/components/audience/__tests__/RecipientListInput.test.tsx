import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RecipientListInput from "../RecipientListInput";

vi.mock("@/lib/Notifications", () => ({
  showSuccessNotification: vi.fn(),
  showErrorNotification: vi.fn(),
}));

describe("RecipientListInput", () => {
  it("emits only on user edits, never the seeded recipients on mount", async () => {
    const onChange = vi.fn();
    render(
      <RecipientListInput
        projectId="p1"
        mode="identifiers"
        recipients={["user_1", "user_2"]}
        onChange={onChange}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.type(
      screen.getByLabelText("User ids, one per line or comma-separated"),
      ",user_3"
    );
    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(["user_1", "user_2", "user_3"])
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
