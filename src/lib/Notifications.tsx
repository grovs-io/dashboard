import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

// Same type+message replaces the existing toast instead of stacking a duplicate.
const errorId = (message: string): string => `error:${message}`;
const successId = (message: string): string => `success:${message}`;
const infoId = (message: string): string => `info:${message}`;

type ToastType = "success" | "error" | "info";
type ToastAction = { label: string; onClick: () => void };

// Renders the whole card: Toaster is unstyled, so Sonner's card CSS doesn't apply.
function ToastRow({
  type,
  message,
  description,
  toastId,
  action,
}: {
  type: ToastType;
  message: string;
  description?: string;
  toastId: string | number;
  action?: ToastAction;
}) {
  const Icon =
    type === "success" ? CheckCircle2 : type === "error" ? AlertCircle : Info;
  const iconClassName =
    type === "success"
      ? "text-emerald-600"
      : type === "error"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <div className="flex w-full items-start gap-2.5 rounded-[10px] border border-border bg-card px-3 py-2.5 text-[13px] leading-5 text-card-foreground shadow-[0_10px_28px_-12px_rgba(16,24,40,0.28)] sm:w-[420px]">
      <Icon className={`h-4 w-4 shrink-0 ${iconClassName}`} />
      <div className="min-w-0 flex-1">
        <div>{message}</div>
        {description && (
          <div className="mt-0.5 text-muted-foreground">{description}</div>
        )}
      </div>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onClick();
            toast.dismiss(toastId);
          }}
          className="h-6 shrink-0 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => toast.dismiss(toastId)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function showToast(
  type: ToastType,
  message: string,
  duration: number,
  options?: { description?: string; action?: ToastAction }
): void {
  const id =
    type === "success"
      ? successId(message)
      : type === "error"
        ? errorId(message)
        : infoId(message);
  toast.custom(
    (toastId) => (
      <ToastRow
        type={type}
        message={message}
        description={options?.description}
        toastId={toastId}
        action={options?.action}
      />
    ),
    { id, duration }
  );
}

// Errors with an action stay until closed; plain errors auto-dismiss (hover pauses).
const ERROR_MS = 8000;

export const showGenericError = (): void => {
  showToast("error", "Something went wrong, please try again", ERROR_MS);
};

export const showSuccessNotification = (message: string): void => {
  showToast("success", message, 3000);
};

export const showExportNotification = (): void => {
  showToast(
    "success",
    "We're preparing your CSV. You'll receive an email with a download link valid for 24 hours.",
    10000
  );
};

export const showErrorNotification = (
  message: string,
  description?: string
): void => {
  showToast("error", message, ERROR_MS, { description });
};

export const showInfoNotification = (message: string): void => {
  showToast("info", message, 5000);
};

export const showErrorNotificationWithLink = (
  message: string,
  onSuccess: () => void
): void => {
  showToast("error", message, Infinity, {
    action: { label: "View", onClick: onSuccess },
  });
};

export const showRetryableError = (
  message: string,
  onRetry: () => void
): void => {
  showToast("error", message, Infinity, {
    action: { label: "Retry", onClick: onRetry },
  });
};
