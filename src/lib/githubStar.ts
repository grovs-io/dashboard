// Whether to ask this browser for a GitHub star: days used, asks shown, snooze, done.
const KEY = "grovs:github_star";
const MAX_ASKS = 3;
const MIN_DAYS = 3;
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

export interface StarState {
  days: string[];
  asks: number;
  snoozed_until: number;
  done: boolean;
}

const EMPTY: StarState = { days: [], asks: 0, snoozed_until: 0, done: false };

export function readStarState(): StarState | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) as Partial<StarState>;
    if (!p || typeof p !== "object") return null;
    return {
      days: Array.isArray(p.days)
        ? p.days.filter((d): d is string => typeof d === "string")
        : [],
      asks: typeof p.asks === "number" ? p.asks : 0,
      snoozed_until: typeof p.snoozed_until === "number" ? p.snoozed_until : 0,
      done: p.done === true,
    };
  } catch {
    return null;
  }
}

export function writeStarState(state: StarState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Blocked storage: the next read fails too, so we never ask.
  }
}

export function localDay(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function recordVisit(state: StarState, today: string): StarState {
  if (state.days.includes(today)) return state;
  return { ...state, days: [...state.days, today].slice(-MIN_DAYS) };
}

export function shouldAsk(state: StarState | null, now: number): boolean {
  return (
    !!state &&
    !state.done &&
    state.asks < MAX_ASKS &&
    state.days.length >= MIN_DAYS &&
    now >= state.snoozed_until
  );
}

export function snooze(state: StarState, now: number): StarState {
  return { ...state, snoozed_until: now + SNOOZE_MS };
}

export function markDone(state: StarState): StarState {
  return { ...state, done: true };
}
