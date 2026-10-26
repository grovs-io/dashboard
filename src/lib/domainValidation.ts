import { isURL } from "validator";

// The SDK sends `${protocol}//${hostname}`, so pages loaded from disk (Electron builds) identify as this.
export const FILE_ORIGIN = "file://";

export const isLocalhost = (value: string) => {
  try {
    const url = new URL(value);
    return url.hostname === "localhost";
  } catch {
    return false;
  }
};

export const isDomainValid = (value: string) =>
  value === FILE_ORIGIN ||
  isURL(value, {
    require_protocol: true,
    protocols: ["http", "https"],
    require_tld: !isLocalhost(value),
  });
