"use client";

import { cn } from "@/lib/utils";
import { CopyChip } from "../../primitives";
import { markAddedLines } from "../../setupRules";

const KEYWORDS =
  /^@?(import|from|func|class|extension|return|true|false|let|var|val|fun|override|super|const|new|if|else|main)$/;

// Just enough colour to read: keywords, strings, comments.
const colorize = (text: string) =>
  text
    .split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\/\/.*$|@?\b\w+\b)/)
    .map((part, i) => {
      if (part.startsWith("//"))
        return (
          <span key={i} className="text-muted-foreground/70">
            {part}
          </span>
        );
      if (/^["']/.test(part))
        return (
          <span key={i} className="text-[#0A7F3F] dark:text-[#9BD3A0]">
            {part}
          </span>
        );
      if (KEYWORDS.test(part))
        return (
          <span key={i} className="text-[#8250DF] dark:text-[#C3A6F5]">
            {part}
          </span>
        );
      return part;
    });

/** A file's code with line numbers; lines the developer adds are marked +. */
export const CodePanel = ({
  filename,
  code,
  highlight = true,
}: {
  filename: string;
  code: string;
  highlight?: boolean;
}) => {
  const lines = markAddedLines(code);
  return (
    <div
      data-code-panel
      className="overflow-hidden rounded-[9px] border border-foreground/[0.11] bg-muted dark:bg-white/[0.03]"
    >
      <div className="flex h-[34px] items-center border-b border-border px-3 font-mono text-xs text-muted-foreground">
        {filename}
        <CopyChip
          value={code}
          bare
          label="Copy"
          className="ml-auto text-foreground/75"
        />
      </div>
      <div className="overflow-x-auto py-2.5">
        <pre className="min-w-max font-mono text-xs leading-[1.75] text-foreground">
          {lines.map((line, i) => {
            const added = highlight && line.added;
            return (
              <div
                key={i}
                data-added={added || undefined}
                className={cn(
                  "grid grid-cols-[34px_1fr] pr-3",
                  added && "bg-chart-users/[0.08]"
                )}
              >
                <i
                  className={cn(
                    "pr-3 text-right not-italic text-muted-foreground/60 select-none",
                    added && "text-chart-users"
                  )}
                >
                  {added ? "+" : i + 1}
                </i>
                <span>{line.text ? colorize(line.text) : " "}</span>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
};

/** One copyable command or URL on a muted line. */
export const CopyLine = ({ value }: { value: string }) => (
  <div className="flex h-10 items-center gap-3 rounded-lg border border-foreground/[0.11] bg-muted pr-3 pl-3 font-mono text-[13px] dark:bg-white/[0.03]">
    <span className="min-w-0 flex-1 truncate">{value}</span>
    <CopyChip value={value} bare />
  </div>
);

/** Where / value / copy table, e.g. associated domains and URL scheme. */
export const ValueTable = ({
  rows,
}: {
  rows: { where: string; value: string }[];
}) => (
  <div className="overflow-hidden rounded-[9px] border border-foreground/[0.11] text-[13px]">
    <div className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)_44px] gap-2.5 border-b border-border bg-muted px-3 py-[9px] text-xs text-muted-foreground dark:bg-white/[0.03]">
      <span>Where</span>
      <span>Value</span>
      <span />
    </div>
    {rows.map((row) => (
      <div
        key={`${row.where}-${row.value}`}
        className="grid grid-cols-[minmax(0,130px)_minmax(0,1fr)_44px] items-center gap-2.5 border-t border-border px-3 py-[9px] [&:nth-child(2)]:border-t-0"
      >
        <span>{row.where}</span>
        <code className="font-mono text-[12.5px] break-all">{row.value}</code>
        <span className="text-right">
          <CopyChip value={row.value} bare />
        </span>
      </div>
    ))}
  </div>
);
