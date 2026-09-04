"use client";

import { Fragment, type ReactNode } from "react";

/**
 * Presentation helpers for event property values and raw JSON.
 * Dependency-free — a tiny tokenizer drives the syntax highlighting so we stay
 * true to the "no bloat" design direction (no react-json-view et al.).
 */

/** Human-readable rendering of a single property value. */
export function formatPropertyValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}

/** Type-aware colour for a scalar property value (matches the JSON palette). */
export function propertyValueClass(val: unknown): string {
  if (val === null || val === undefined) return "text-muted-foreground italic";
  switch (typeof val) {
    case "number":
      return "text-[var(--chart-1)] tabular-nums";
    case "boolean":
      return "text-[var(--chart-2)]";
    default:
      return "text-foreground";
  }
}

// Matches: quoted strings (keys & values), booleans, null, numbers.
// Built fresh per call so the stateful `lastIndex` is never shared/mutated.
const TOKEN_SOURCE =
  '"(?:\\\\.|[^"\\\\])*"|\\b(?:true|false)\\b|\\bnull\\b|-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?';

/**
 * Renders a value as syntax-highlighted, pretty-printed JSON.
 * Keys → accent blue · strings → green · numbers → amber · booleans → teal ·
 * null → muted. Punctuation inherits the muted base colour of the container.
 */
export function JsonHighlight({ value }: { value: unknown }): ReactNode {
  const json = JSON.stringify(value, null, 2) ?? "null";
  const nodes: ReactNode[] = [];
  const token = new RegExp(TOKEN_SOURCE, "g");
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;

  while ((match = token.exec(json)) !== null) {
    if (match.index > last) {
      nodes.push(
        <Fragment key={key++}>{json.slice(last, match.index)}</Fragment>
      );
    }

    const text = match[0];
    let cls: string;
    if (text[0] === '"') {
      const isKey = /^\s*:/.test(json.slice(token.lastIndex));
      cls = isKey ? "text-[var(--chart-users)]" : "text-[var(--valid-green)]";
    } else if (text === "true" || text === "false") {
      cls = "text-[var(--chart-2)]";
    } else if (text === "null") {
      cls = "text-muted-foreground italic";
    } else {
      cls = "text-[var(--chart-1)]";
    }

    nodes.push(
      <span key={key++} className={cls}>
        {text}
      </span>
    );
    last = token.lastIndex;
  }

  if (last < json.length) {
    nodes.push(<Fragment key={key++}>{json.slice(last)}</Fragment>);
  }

  return <>{nodes}</>;
}
