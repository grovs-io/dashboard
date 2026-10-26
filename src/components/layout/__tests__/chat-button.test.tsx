import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const toggleChat = vi.fn();
vi.mock("@/context/useChatwoot", () => ({
  useChatwoot: () => ({ toggleChat }),
}));

const renderButton = async (enabled: boolean) => {
  vi.resetModules();
  vi.doMock("@/lib/integrations", () => ({ CHATWOOT_ENABLED: enabled }));
  const { ChatButton } = await import("@/components/layout/chat-button");
  return render(<ChatButton />);
};

describe("ChatButton", () => {
  beforeEach(() => toggleChat.mockClear());

  it("opens the chat when Chatwoot is enabled", async () => {
    await renderButton(true);
    fireEvent.click(screen.getByRole("button", { name: "Live chat" }));
    expect(toggleChat).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when Chatwoot is disabled", async () => {
    const { container } = await renderButton(false);
    expect(container).toBeEmptyDOMElement();
  });
});
