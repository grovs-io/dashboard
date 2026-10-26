"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/copyTextHelper";
import { showErrorNotification } from "@/lib/Notifications";

// Layout

export const StepPage = ({
  left,
  right,
  footer,
  leftRef,
  onLeftScroll,
}: {
  left: ReactNode;
  right?: ReactNode;
  footer: ReactNode;
  leftRef?: React.Ref<HTMLDivElement>;
  onLeftScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}) => (
  <>
    <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_470px]">
      <div
        ref={leftRef}
        onScroll={onLeftScroll}
        data-testid="setup-left"
        className="relative flex min-h-0 flex-col overflow-y-auto px-4 py-7 sm:px-10 sm:py-10 lg:pr-14 lg:pl-16 [&>*]:shrink-0"
      >
        {left}
      </div>
      {right !== undefined && (
        <aside className="hidden min-h-0 flex-col items-center overflow-hidden border-l border-border bg-muted px-8 pt-7 pb-5 lg:flex dark:bg-card [&>*]:shrink-0">
          {right}
        </aside>
      )}
    </div>
    <footer className="flex h-[70px] shrink-0 items-center gap-2.5 border-t border-border px-4 sm:pr-6 sm:pl-10 lg:pl-16">
      {footer}
    </footer>
  </>
);

export const FooterSpacer = () => <span className="flex-1" />;

export const StepTitle = ({ children }: { children: ReactNode }) => (
  <h1 className="mb-2 text-[22px] leading-tight font-semibold tracking-[-0.02em] sm:text-2xl">
    {children}
  </h1>
);

export const Lead = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <p
    className={cn(
      "mb-6 max-w-[540px] text-[14.5px] leading-[1.6] text-foreground/75",
      className
    )}
  >
    {children}
  </p>
);

export const FieldLabel = ({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) => (
  <label
    htmlFor={htmlFor}
    className={cn("mb-[7px] block text-[13px] font-medium", className)}
  >
    {children}
  </label>
);

export const Hint = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <p
    className={cn(
      "mt-2 text-[13px] leading-normal text-muted-foreground",
      className
    )}
  >
    {children}
  </p>
);

export const ErrorText = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="mt-2 text-[12.5px] text-destructive">
    {children}
  </p>
);

export const PanelCaption = ({ children }: { children: ReactNode }) => (
  <div className="mb-[18px] self-center text-xs font-medium text-muted-foreground">
    {children}
  </div>
);

// Buttons

export const PrimaryButton = ({
  className,
  ...props
}: React.ComponentProps<typeof Button>) => (
  <Button
    className={cn(
      "h-9 rounded-lg bg-foreground px-4 text-sm text-background shadow-none hover:bg-foreground/85 disabled:opacity-35",
      className
    )}
    {...props}
  />
);

export const QuietButton = ({
  className,
  ...props
}: React.ComponentProps<typeof Button>) => (
  <Button
    variant="ghost"
    className={cn(
      "h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-transparent hover:text-foreground",
      className
    )}
    {...props}
  />
);

export const OutlineButton = ({
  className,
  ...props
}: React.ComponentProps<typeof Button>) => (
  <Button
    variant="outline"
    className={cn(
      "h-[30px] rounded-[7px] px-3 text-[13px] font-medium shadow-none",
      className
    )}
    {...props}
  />
);

export const TextLink = ({
  className,
  children,
  ...props
}: React.ComponentProps<"button">) => (
  <button
    type="button"
    className={cn(
      "text-foreground underline decoration-foreground/25 underline-offset-[3px] transition-colors hover:decoration-foreground/60",
      className
    )}
    {...props}
  >
    {children}
  </button>
);

export const DocLink = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1 text-foreground underline decoration-foreground/25 underline-offset-[3px] hover:decoration-foreground/60"
  >
    {children}
    <ExternalLink className="size-3 text-muted-foreground" />
  </a>
);

// Status marks

export const OkMark = ({
  className,
  label = "Done",
}: {
  className?: string;
  label?: string;
}) => (
  <span
    role="img"
    aria-label={label}
    className={cn(
      "grid size-5 shrink-0 place-items-center rounded-full bg-valid-green/12 text-valid-green",
      className
    )}
  >
    <Check className="size-3 stroke-[2.6]" />
  </span>
);

export const Spinner = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className={cn("size-[15px] shrink-0 animate-spin", className)}
  >
    <circle
      cx="12"
      cy="12"
      r="9"
      fill="none"
      stroke="currentColor"
      strokeOpacity=".2"
      strokeWidth="2.4"
    />
    <path
      d="M21 12a9 9 0 0 0-9-9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  </svg>
);

export const PendingMark = () => (
  <span
    aria-hidden
    className="size-3.5 shrink-0 rounded-full border-[1.5px] border-dashed border-muted-foreground/50"
  />
);

// Choices

export const RadioDot = ({ on }: { on: boolean }) => (
  <span
    aria-hidden
    className={cn(
      "mt-0.5 size-4 shrink-0 rounded-full border-[1.5px] border-foreground/20 bg-background transition-all",
      on && "border-[5px] border-chart-users"
    )}
  />
);

/** Stacked rows in one outlined box; the selected row is tinted soft blue. */
export const ChoiceRows = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => (
  <div
    role="radiogroup"
    className={cn(
      "overflow-hidden rounded-[11px] border border-foreground/[0.11]",
      className
    )}
  >
    {children}
  </div>
);

export const ChoiceRow = ({
  selected,
  onSelect,
  title,
  subtitle,
  aside,
  disabled,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
}) => (
  <div
    className={cn(
      "border-t border-foreground/[0.11] first:border-t-0",
      selected && "bg-chart-users/[0.05] dark:bg-chart-users/[0.08]"
    )}
  >
    <div className="grid grid-cols-[18px_1fr_auto] items-start gap-3 px-4 py-3.5">
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && onSelect()}
        className={cn(
          "col-span-2 grid grid-cols-[18px_1fr] gap-3 text-left",
          disabled ? "cursor-default opacity-60" : "cursor-pointer"
        )}
      >
        <RadioDot on={selected} />
        <span className="min-w-0">
          <span className="block text-[14.5px] font-semibold">{title}</span>
          {subtitle && (
            <span className="mt-0.5 block text-[13px] text-muted-foreground">
              {subtitle}
            </span>
          )}
        </span>
      </button>
      {aside && (
        <span className="mt-0.5 text-[13px] text-muted-foreground">
          {aside}
        </span>
      )}
    </div>
    {selected && children && (
      <div className="px-4 pb-4 sm:pl-[46px]">{children}</div>
    )}
  </div>
);

/** Two-up option card: icon tile, title, description, check when chosen. */
export const OptionCard = ({
  selected,
  onSelect,
  icon,
  title,
  description,
  disabled,
  aside,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  aside?: ReactNode;
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    disabled={disabled}
    onClick={onSelect}
    className={cn(
      "flex min-w-0 items-center gap-[11px] rounded-xl border px-[13px] py-[11px] text-left transition-colors",
      selected
        ? "border-chart-users/45 bg-chart-users/[0.04] dark:bg-chart-users/[0.07]"
        : "border-foreground/[0.11] bg-muted/70 hover:border-foreground/20 dark:bg-white/[0.02]",
      disabled && "cursor-default opacity-50 hover:border-foreground/[0.11]"
    )}
  >
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg border [&_svg]:size-[15px]",
        selected
          ? "border-transparent bg-chart-users/12 text-chart-users"
          : "border-foreground/[0.11] bg-background text-muted-foreground"
      )}
    >
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block text-[13.5px] font-medium">{title}</span>
      <span className="mt-px block text-xs leading-[1.35] text-muted-foreground">
        {description}
      </span>
    </span>
    {aside}
    {selected && !aside && (
      <span className="ml-auto grid size-5 shrink-0 place-items-center rounded-full bg-chart-users/12 text-chart-users">
        <Check className="size-3 stroke-[2.6]" />
      </span>
    )}
  </button>
);

/** Pill segmented control, as in the platform switch. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: {
    value: T;
    label: ReactNode;
    icon?: ReactNode;
    extra?: ReactNode;
  }[];
  size?: "sm" | "md";
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full gap-0.5 self-start overflow-x-auto rounded-[11px] border border-border bg-foreground/[0.04] p-[3px] scrollbar-hide",
        size === "sm" && "rounded-[9px] p-0.5",
        className
      )}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 text-[13.5px] whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
              size === "md" ? "h-9 pl-3" : "h-7 rounded-md px-3 text-[13px]",
              on &&
                "bg-background font-medium text-foreground shadow-[0_1px_2px_rgba(16,24,40,.08)] ring-1 ring-border"
            )}
          >
            {option.icon}
            {option.label}
            {option.extra}
          </button>
        );
      })}
    </div>
  );
}

/** Text tabs underlined in blue, used inside a part. */
export function TextTabs<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="mb-3 flex flex-wrap gap-x-[18px] gap-y-1 text-[13px] text-muted-foreground"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            "pb-1 hover:text-foreground",
            option.value === value &&
              "font-medium text-foreground underline decoration-chart-users decoration-2 underline-offset-[6px]"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

// Fields

/** Input with optional fixed prefix and a green check once valid. */
export const SetupInput = ({
  value,
  onChange,
  prefix,
  valid,
  invalid,
  mono = true,
  tone = "soft",
  className,
  inputClassName,
  ...props
}: Omit<React.ComponentProps<"input">, "onChange" | "prefix"> & {
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  valid?: boolean;
  invalid?: boolean;
  mono?: boolean;
  tone?: "soft" | "plain";
  inputClassName?: string;
}) => (
  <div
    className={cn(
      "flex h-10 min-w-0 items-center rounded-lg border pr-2.5 pl-3 text-[13.5px] transition-[border-color,box-shadow] focus-within:border-chart-users focus-within:ring-3 focus-within:ring-chart-users/15",
      mono && "font-mono",
      tone === "soft"
        ? "border-chart-users/30 bg-chart-users/[0.05] dark:border-chart-users/35 dark:bg-chart-users/[0.08]"
        : "border-foreground/[0.13] bg-background",
      invalid &&
        "border-destructive/45 ring-3 ring-destructive/10 focus-within:border-destructive/60 focus-within:ring-destructive/10",
      className
    )}
  >
    {prefix && (
      <span className="shrink-0 text-muted-foreground select-none">
        {prefix}
      </span>
    )}
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      autoCapitalize="off"
      autoComplete="off"
      className={cn(
        "h-full min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/60",
        prefix && "font-semibold",
        inputClassName
      )}
      {...props}
    />
    {valid && <OkMark className="ml-2" label="Valid" />}
  </div>
);

/** Lets a surrounding section know something inside it was copied. */
export const CopiedContext = createContext<() => void>(() => {});

export function useCopy() {
  const onCopied = useContext(CopiedContext);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );
  const copy = (value: string) => {
    void copyToClipboard(value).then((ok) => {
      if (!ok) {
        showErrorNotification("Couldn't copy — select the text and copy it");
        return;
      }
      onCopied();
      setCopied(true);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    });
  };
  return { copied, copy };
}

export const CopyChip = ({
  value,
  label = "Copy",
  className,
  bare,
}: {
  value: string;
  label?: string;
  className?: string;
  bare?: boolean;
}) => {
  const { copied, copy } = useCopy();
  return (
    <button
      type="button"
      onClick={() => copy(value)}
      aria-label={`${label} ${value}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 font-sans text-[12.5px] font-medium",
        bare
          ? "text-muted-foreground hover:text-foreground"
          : "h-7 rounded-md bg-foreground/[0.05] px-2.5 text-foreground/75 hover:bg-foreground/[0.08]",
        className
      )}
    >
      {!bare &&
        (copied ? (
          <Check className="size-3.5 text-valid-green" />
        ) : (
          <Copy className="size-3.5" />
        ))}
      {copied ? "Copied" : label}
    </button>
  );
};

export const CopyField = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="mb-2.5">
    <FieldLabel className="mb-1.5">{label}</FieldLabel>
    <div className="flex h-10 items-center gap-2 rounded-lg border border-chart-users/30 bg-background pr-1.5 pl-3 font-mono text-[13px] dark:border-chart-users/35">
      <span className="min-w-0 flex-1 truncate">{value}</span>
      <CopyChip value={value} />
    </div>
  </div>
);

// Help column

export const HelpDocs = ({ children }: { children: ReactNode }) => (
  <div className="w-full max-w-[400px] self-center text-[13.5px] leading-[1.6] text-foreground/75 [&_b]:font-medium [&_b]:text-foreground [&_code]:font-mono [&_code]:text-[12.5px] [&_ol]:list-decimal [&_ol]:pl-[18px] [&_li]:my-[3px]">
    <h4 className="mb-3 text-xs font-medium text-muted-foreground">Help</h4>
    {children}
  </div>
);

export const HelpTitle = ({ children }: { children: ReactNode }) => (
  <h5 className="mt-[18px] mb-1.5 text-sm font-semibold text-foreground first-of-type:mt-0">
    {children}
  </h5>
);

export const HelpPitfalls = ({
  title = "Common mistakes",
  items,
}: {
  title?: string;
  items: ReactNode[];
}) => (
  <div className="mt-[18px] border-t border-border pt-3.5">
    <b>{title}</b>
    {items.map((item, i) => (
      <p key={i} className="my-1 text-[13px] text-muted-foreground">
        {item}
      </p>
    ))}
  </div>
);

export const HelpLinks = ({ children }: { children: ReactNode }) => (
  <div className="mt-4 flex flex-col items-start gap-1.5 text-[13px]">
    {children}
  </div>
);

export const docsUrl = (path: string) =>
  `${process.env.NEXT_PUBLIC_DOCS_URL ?? "https://docs.grovs.io"}${path}`;
