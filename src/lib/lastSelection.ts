// The instance and environment last chosen on this browser, so a reload lands where the person was.
const KEY = "grovs:last_selection";

export interface LastSelection {
  instance_id: string;
  env_type: string;
}

export function readLastSelection(): LastSelection | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastSelection>;
    return typeof parsed.instance_id === "string" &&
      typeof parsed.env_type === "string"
      ? { instance_id: parsed.instance_id, env_type: parsed.env_type }
      : null;
  } catch {
    return null;
  }
}

export function writeLastSelection(selection: LastSelection): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(selection));
  } catch {
    // Private windows and blocked storage: the URL still carries the choice.
  }
}
