"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";
import { writeSearchParams } from "@/lib/searchParamsUrl";

export function useUrlState(
  key: string,
  defaultValue: string
): [string, (v: string) => void];
export function useUrlState<T>(
  key: string,
  defaultValue: T,
  options: {
    parse: (v: string) => T;
    serialize?: (v: T) => string;
  }
): [T, (v: T) => void];
export function useUrlState<T = string>(
  key: string,
  defaultValue: T,
  options?: {
    parse?: (v: string) => T;
    serialize?: (v: T) => string;
  }
): [T, (v: T) => void] {
  const searchParams = useSearchParams();

  // Use refs for options to avoid dependency instability from inline objects
  const parseRef = useRef(options?.parse);
  parseRef.current = options?.parse;
  const serializeRef = useRef(options?.serialize);
  serializeRef.current = options?.serialize;

  const value = useMemo(() => {
    const raw = searchParams.get(key);
    if (raw === null) return defaultValue;
    if (parseRef.current) return parseRef.current(raw);
    return raw as T;
  }, [searchParams, key, defaultValue]);

  const setValue = useCallback(
    (newValue: T) => {
      const serialized = serializeRef.current
        ? serializeRef.current(newValue)
        : String(newValue);

      writeSearchParams({
        [key]:
          serialized === String(defaultValue) || serialized === ""
            ? null
            : serialized,
      });
    },
    [key, defaultValue]
  );

  return [value, setValue];
}
