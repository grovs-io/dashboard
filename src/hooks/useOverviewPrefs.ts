"use client";

import { useCallback, useEffect, useState } from "react";

export type OverviewPrefs = {
  metric?: string;
  granularity?: string;
  breakdown?: string;
  breakdownMetric?: Record<string, string>;
  timeline?: boolean;
  compare?: boolean;
  top?: number;
  /** Last dashboard opened: a built-in key or a board id. */
  dashboard?: string;
};

const storageKey = (projectId: string) => `overview:prefs:${projectId}`;

function readPrefs(projectId: string): OverviewPrefs {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return parsed as OverviewPrefs;
  } catch {
    return {};
  }
}

function writePrefs(projectId: string, prefs: OverviewPrefs): void {
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(prefs));
  } catch {
    // Quota exceeded or blocked storage (private windows) — prefs just won't persist.
  }
}

/** Reads only in an effect after mount, so SSR/hydration stay consistent. */
export function useOverviewPrefs(projectId: string | undefined) {
  const [prefs, setPrefs] = useState<OverviewPrefs>({});
  const [loaded, setLoaded] = useState(false);
  // State, not an effect reset, so `loaded` turns false on the same render the project changes.
  const [loadedProjectId, setLoadedProjectId] = useState<string | undefined>(
    undefined
  );

  useEffect(() => {
    if (!projectId) return;
    setPrefs(readPrefs(projectId));
    setLoaded(true);
    setLoadedProjectId(projectId);
  }, [projectId]);

  const remember = useCallback(
    (patch: Partial<OverviewPrefs>) => {
      if (!projectId) return;
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        writePrefs(projectId, next);
        return next;
      });
    },
    [projectId]
  );

  return { prefs, remember, loaded: loaded && loadedProjectId === projectId };
}
