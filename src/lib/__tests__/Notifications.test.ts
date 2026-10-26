import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: { custom: vi.fn(), dismiss: vi.fn() },
}));

import { toast as realToast } from "sonner";
import {
  showGenericError,
  showSuccessNotification,
  showExportNotification,
  showErrorNotification,
  showErrorNotificationWithLink,
  showRetryableError,
  showInfoNotification,
} from "../Notifications";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- vi.mock replaces these with mock fns at runtime
const toast = realToast as any;

describe("Notifications", () => {
  beforeEach(() => {
    toast.custom.mockClear();
    toast.dismiss.mockClear();
  });

  it("success notification uses a 3s duration and a success-scoped id", () => {
    showSuccessNotification("Saved");
    const [, options] = toast.custom.mock.calls[0];
    expect(options).toEqual({ id: "success:Saved", duration: 3000 });
  });

  it("export notification keeps its 10s duration", () => {
    showExportNotification();
    const [, options] = toast.custom.mock.calls[0];
    expect(options.duration).toBe(10000);
  });

  it("generic error auto-dismisses after 8s", () => {
    showGenericError();
    const [, options] = toast.custom.mock.calls[0];
    expect(options).toEqual({
      id: "error:Something went wrong, please try again",
      duration: 8000,
    });
  });

  it("plain error notification auto-dismisses after 8s", () => {
    showErrorNotification("Could not save", "Try again later");
    const [, options] = toast.custom.mock.calls[0];
    expect(options).toEqual({ id: "error:Could not save", duration: 8000 });
  });

  it("error with a View action persists, renders the message, and keeps the action working", () => {
    const onSuccess = vi.fn();
    showErrorNotificationWithLink("Denied", onSuccess);
    const [factory, options] = toast.custom.mock.calls[0];
    expect(options.duration).toBe(Infinity);
    expect(options.id).toBe("error:Denied");

    render(factory("toast-1"));
    expect(screen.getByText("Denied")).toBeInTheDocument();
    fireEvent.click(screen.getByText("View"));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(toast.dismiss).toHaveBeenCalledWith("toast-1");
  });

  it("retryable error persists, renders the message, and keeps Retry working", () => {
    const onRetry = vi.fn();
    showRetryableError("Failed", onRetry);
    const [factory, options] = toast.custom.mock.calls[0];
    expect(options.duration).toBe(Infinity);
    expect(options.id).toBe("error:Failed");

    render(factory("toast-2"));
    fireEvent.click(screen.getByText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(toast.dismiss).toHaveBeenCalledWith("toast-2");
  });

  it("the inline close button dismisses by id instead of Sonner's default close", () => {
    showErrorNotification("Dismiss me");
    const [factory] = toast.custom.mock.calls[0];
    render(factory("toast-3"));
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(toast.dismiss).toHaveBeenCalledWith("toast-3");
  });

  it("same message called twice reuses the same id, so the toast replaces instead of stacking", () => {
    showErrorNotification("Duplicate");
    showErrorNotification("Duplicate");
    const firstId = toast.custom.mock.calls[0][1].id;
    const secondId = toast.custom.mock.calls[1][1].id;
    expect(firstId).toBe(secondId);
  });

  it("info notification uses a 5s duration and an info-scoped id", () => {
    showInfoNotification("Heads up");
    const [, options] = toast.custom.mock.calls[0];
    expect(options).toEqual({ id: "info:Heads up", duration: 5000 });
  });

  it("error with a description renders both lines", () => {
    showErrorNotification("Can't be deleted", "It's still in use.");
    const [factory] = toast.custom.mock.calls[0];
    render(factory("toast-4"));
    expect(screen.getByText("Can't be deleted")).toBeInTheDocument();
    expect(screen.getByText("It's still in use.")).toBeInTheDocument();
  });

  it("the row renders its own full card, since Sonner is unstyled for custom toasts", () => {
    showErrorNotification("Styled card");
    const [factory] = toast.custom.mock.calls[0];
    render(factory("toast-5"));
    const card = screen.getByText("Styled card").parentElement!.parentElement!;
    expect(card.className).toMatch(/bg-card/);
    expect(card.className).toMatch(/border-border/);
    expect(card.className).toMatch(/rounded-\[10px\]/);
  });
});
