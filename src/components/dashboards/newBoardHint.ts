const key = (id: number) => `dashboards:ready-hint:${id}`;

/** Flags a freshly copied board so it shows its one-time hint. */
export function markNewBoard(id: number): void {
  try {
    window.localStorage.setItem(key(id), "1");
  } catch {
    // Blocked storage: the hint just won't show.
  }
}

export function isNewBoard(id: number): boolean {
  try {
    return window.localStorage.getItem(key(id)) === "1";
  } catch {
    return false;
  }
}

export function dismissNewBoard(id: number): void {
  try {
    window.localStorage.removeItem(key(id));
  } catch {
    // Nothing to clean up.
  }
}
