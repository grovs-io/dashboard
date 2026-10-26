import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { instance, makeData } from "@/components/onboarding/__tests__/fixtures";

const m = vi.hoisted(() => ({ download: vi.fn() }));

vi.mock("@/lib/googleSetupScript", () => ({
  downloadGoogleSetupScript: m.download,
}));
vi.mock("@/hooks/mutations/useInstanceMutations", () => ({
  useSetAndroidWebhookKeyMutation: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));
vi.mock("@/hooks/queries/useInstanceQueries", () => ({
  useGoogleConfigScriptQuery: () => ({ data: "#!/bin/bash" }),
}));

import RevenueSetup from "../RevenueSetup";

describe("RevenueSetup (Google Play)", () => {
  it("offers the setup script and asks for the topic name, not a URL", () => {
    render(
      <RevenueSetup platform="android" instance={instance} data={makeData()} />
    );
    expect(screen.queryByText("Notifications URL")).not.toBeInTheDocument();
    expect(screen.getByText(/topic name the script/)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Download setup script" })
    );
    expect(m.download).toHaveBeenCalledWith("#!/bin/bash");
  });
});
