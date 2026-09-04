import {
  showErrorNotification,
  showSuccessNotification,
} from "./Notifications";

// navigator.clipboard only exists on secure origins; plain-HTTP self-hosted dashboards need the legacy path.
export async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  const el = document.createElement("textarea");
  el.value = value;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  try {
    el.focus();
    el.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(el);
  }
}

export const handleCopyText = (copyValue: string) => {
  void copyToClipboard(copyValue).then((ok) => {
    if (ok) showSuccessNotification("Copied to clipboard");
    else
      showErrorNotification(
        "Couldn't copy — select the text and copy it manually"
      );
  });
};
