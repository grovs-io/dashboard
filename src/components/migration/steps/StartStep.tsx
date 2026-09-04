"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  ChevronDown,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { IS_SELF_HOSTED } from "@/lib/edition";
import {
  credentialsSchemaFor,
  migrationOldHostSchema,
} from "@/schemas/migration";
import ExtraHostsInput from "../ExtraHostsInput";
import CredentialsFields, {
  APPSFLYER_EMPTY,
  BRANCH_EMPTY,
  type AppsflyerValues,
  type BranchValues,
} from "../CredentialsFields";
import type { MigrationCredentials, MigrationProvider } from "@/types";
import type { CustomDomainPreflight } from "@/types";

interface StartStepProps {
  onSubmit: (values: {
    provider: MigrationProvider;
    hostname: string;
    credentials: MigrationCredentials;
    providerHosted: boolean;
    extraHosts: string[];
  }) => void | Promise<void>;
  isSubmitting?: boolean;
  disabledUntilSeconds?: number;
  hostnameFieldError?: string | null;
  extraHostsFieldError?: string | null;
  onHostnameChange?: (hostname: string) => void;
  onProviderHostedChange?: (providerHosted: boolean) => void;
  preflight?: CustomDomainPreflight | null;
  preflightLoading?: boolean;
  /**
   * Optional cancel slot rendered alongside the submit button. Hosted by the
   * wizard so the same affordance (in no-confirm mode here) is available on
   * the empty card.
   */
  cancelSlot?: React.ReactNode;
}

const PROVIDER_OPTIONS: Array<{
  value: MigrationProvider;
  label: string;
  description: string;
}> = [
  {
    value: "branch",
    label: "Branch",
    description: "Migrate links currently served by Branch.io.",
  },
  {
    value: "appsflyer",
    label: "AppsFlyer",
    description: "Migrate links currently served by AppsFlyer.",
  },
];

const ProviderDropdown = ({
  value,
  onChange,
}: {
  value: MigrationProvider | null;
  onChange: (value: MigrationProvider) => void;
}) => {
  const [open, setOpen] = useState(false);
  const selected = PROVIDER_OPTIONS.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Select source platform"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg border border-sidebar-border bg-secondary px-3 py-2.5 text-left transition-all",
            "hover:bg-muted focus-visible:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-primary/10 focus-visible:outline-none"
          )}
        >
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-medium">
              {selected?.label ?? "Select source platform"}
            </span>
            <span className="text-xs text-muted-foreground">
              {selected?.description ?? "Branch or AppsFlyer"}
            </span>
          </div>
          <Separator orientation="vertical" className="ml-auto h-6" />
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-1"
      >
        {PROVIDER_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors",
                isSelected ? "bg-accent" : "hover:bg-accent/50"
              )}
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
              {isSelected && (
                <Check className="ml-auto h-4 w-4 shrink-0 text-primary" />
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};

type DomainOwnership = "own" | "provider";

const OwnershipPicker = ({
  value,
  onChange,
  provider,
}: {
  value: DomainOwnership;
  onChange: (value: DomainOwnership) => void;
  provider: MigrationProvider | null;
}) => {
  const providerLabel =
    provider === "appsflyer"
      ? "AppsFlyer owns it (onelink.me)"
      : "Branch owns it (app.link)";
  const options: Array<{
    value: DomainOwnership;
    label: string;
    description: string;
  }> = [
    {
      value: "own",
      label: "I own the domain",
      description: "You'll point DNS to Grovs after SSL provisions.",
    },
    {
      value: "provider",
      label: providerLabel,
      description: "SDK-only bridge — no DNS changes.",
    },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Who owns the domain?"
      className="flex flex-col gap-2"
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-all",
              selected
                ? "border-primary/40 bg-primary/5 ring-[3px] ring-primary/10"
                : "border-sidebar-border bg-secondary hover:bg-muted"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-primary" : "border-muted-foreground/40"
              )}
            >
              {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

/**
 * The combined first step of the migration wizard.
 *
 * Customers enter provider + credentials + old subdomain in a single form
 * so they can walk away while SSL provisions. The wizard stashes the
 * credentials in React state (in-memory only, never persisted) and
 * automatically arms the migration once the domain becomes active.
 */
const StartStep = ({
  onSubmit,
  isSubmitting = false,
  disabledUntilSeconds,
  hostnameFieldError,
  extraHostsFieldError,
  onHostnameChange,
  onProviderHostedChange,
  preflight,
  preflightLoading = false,
  cancelSlot,
}: StartStepProps) => {
  const [provider, setProvider] = useState<MigrationProvider | null>(null);
  const [hostname, setHostname] = useState("");
  const [ownership, setOwnership] = useState<DomainOwnership>("own");
  const [extraHosts, setExtraHosts] = useState<string[]>([]);
  const providerHosted = IS_SELF_HOSTED && ownership === "provider";

  const handleOwnershipChange = (next: DomainOwnership) => {
    setOwnership(next);
    onProviderHostedChange?.(next === "provider");
    // Preflight is meaningless for provider-owned domains; clear any pending hint.
    onHostnameChange?.(next === "provider" ? "" : hostname);
  };
  const [branchValues, setBranchValues] = useState<BranchValues>(BRANCH_EMPTY);
  const [appsflyerValues, setAppsflyerValues] =
    useState<AppsflyerValues>(APPSFLYER_EMPTY);
  const [showBranchKey, setShowBranchKey] = useState(false);
  const [showApiToken, setShowApiToken] = useState(false);
  const [touched, setTouched] = useState(false);

  const hostnameValidation = useMemo(() => {
    const trimmed = hostname.trim();
    if (trimmed.length === 0) {
      return { ok: false as const, error: null as string | null };
    }
    const result = migrationOldHostSchema.safeParse(trimmed);
    if (result.success) {
      return { ok: true as const, error: null, value: result.data };
    }
    return {
      ok: false as const,
      error: result.error.issues[0]?.message ?? "Invalid hostname",
    };
  }, [hostname]);

  const credentialsParsed = useMemo<{
    ok: boolean;
    value: MigrationCredentials | null;
  }>(() => {
    if (provider === null) return { ok: false, value: null };
    const schema = credentialsSchemaFor(provider);
    const raw =
      provider === "branch"
        ? { branch_key: branchValues.branch_key.trim() }
        : {
            onelink_id: appsflyerValues.onelink_id.trim(),
            api_token: appsflyerValues.api_token.trim(),
          };
    const result = schema.safeParse(raw);
    if (result.success) {
      return { ok: true, value: result.data as MigrationCredentials };
    }
    return { ok: false, value: null };
  }, [provider, branchValues, appsflyerValues]);

  const canSubmit =
    provider !== null &&
    hostnameValidation.ok &&
    credentialsParsed.ok &&
    !isSubmitting &&
    !(typeof disabledUntilSeconds === "number" && disabledUntilSeconds > 0);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (
      !canSubmit ||
      provider === null ||
      !hostnameValidation.ok ||
      credentialsParsed.value === null
    ) {
      return;
    }
    void onSubmit({
      provider,
      hostname: hostnameValidation.value,
      credentials: credentialsParsed.value,
      providerHosted,
      extraHosts,
    });
  };

  const showHostnameError =
    touched && hostname.trim().length > 0 && !hostnameValidation.ok;
  const oldHostLabel = providerHosted
    ? provider === "appsflyer"
      ? "AppsFlyer domain"
      : "Branch domain"
    : provider === "branch"
      ? "Branch subdomain"
      : provider === "appsflyer"
        ? "AppsFlyer subdomain"
        : "Provider subdomain";
  const oldHostPlaceholder = providerHosted
    ? provider === "appsflyer"
      ? "yourapp.onelink.me"
      : "xyz.app.link"
    : "old.acme.com";
  const providerName = provider === "appsflyer" ? "AppsFlyer" : "Branch";
  const extraHostExample =
    provider === "appsflyer"
      ? "yourapp-alt.onelink.me"
      : "xyz-alternate.app.link";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-3">
        <Label>Which provider are you migrating from?</Label>
        <ProviderDropdown value={provider} onChange={setProvider} />
      </div>

      {provider !== null && IS_SELF_HOSTED && (
        <div className="flex flex-col gap-3">
          <Label>Who owns the domain?</Label>
          <OwnershipPicker
            value={ownership}
            onChange={handleOwnershipChange}
            provider={provider}
          />
        </div>
      )}

      {provider !== null && (
        <CredentialsFields
          provider={provider}
          idPrefix="start"
          branchValues={branchValues}
          appsflyerValues={appsflyerValues}
          showBranchKey={showBranchKey}
          showApiToken={showApiToken}
          onBranchChange={setBranchValues}
          onAppsflyerChange={setAppsflyerValues}
          onToggleBranchKey={() => setShowBranchKey((v) => !v)}
          onToggleApiToken={() => setShowApiToken((v) => !v)}
        />
      )}

      {provider !== null && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="migration-old-host">{oldHostLabel}</Label>
          <Input
            id="migration-old-host"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder={oldHostPlaceholder}
            value={hostname}
            aria-invalid={showHostnameError ? true : undefined}
            aria-describedby={
              showHostnameError ? "migration-old-host-error" : undefined
            }
            onChange={(event) => {
              const next = event.target.value.toLowerCase();
              setHostname(next);
              if (!providerHosted) onHostnameChange?.(next);
              if (!touched) setTouched(true);
            }}
            onBlur={() => setTouched(true)}
          />
          {showHostnameError && hostnameValidation.error && (
            <p
              id="migration-old-host-error"
              className="flex items-center gap-1.5 text-xs text-destructive"
            >
              <AlertCircle className="h-3 w-3" />
              {hostnameValidation.error}
            </p>
          )}
          {!showHostnameError && hostnameFieldError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              {hostnameFieldError}
            </p>
          )}
          {!providerHosted &&
            !showHostnameError &&
            !hostnameFieldError &&
            preflightLoading && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking DNS…
              </p>
            )}
          {!providerHosted &&
            !showHostnameError &&
            !hostnameFieldError &&
            preflight && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                {preflight.cname_matches
                  ? "✓ CNAME already points to Grovs"
                  : preflight.dns_error
                    ? "Couldn't resolve — that's fine, you'll set it up later"
                    : preflight.cname_actual
                      ? `Currently points to: ${preflight.cname_actual} (you'll flip this in step 4)`
                      : "CNAME is not pointing to Grovs yet; you'll flip this in step 4"}
              </p>
            )}
          {!providerHosted && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              Submit this subdomain before changing DNS. We provision SSL first;
              traffic moves only after DNS points this host to Grovs.
            </p>
          )}
        </div>
      )}

      {provider !== null && providerHosted && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="migration-extra-hosts">Extra hosts (optional)</Label>
          <ExtraHostsInput
            inputId="migration-extra-hosts"
            value={extraHosts}
            onChange={setExtraHosts}
            mainHost={hostname}
            error={extraHostsFieldError}
            placeholder={extraHostExample}
          />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Sibling domains that serve the same links (for example{" "}
            {extraHostExample}). Press Enter or comma to add each one.
          </p>
        </div>
      )}

      {provider !== null &&
        (providerHosted ? (
          <div className="flex items-start gap-3 rounded-md border border-sidebar-border bg-muted/40 px-3 py-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              A transition bridge: links opened in your app resolve through the
              Grovs SDK; web clicks keep going to {providerName}. Live
              immediately — no DNS or SSL setup.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-amber-900 dark:text-amber-200">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-xs leading-relaxed">
              Your {providerName} links must already run on a subdomain you own.
              Traffic stays with {providerName} until you point DNS here.
              {IS_SELF_HOSTED
                ? ` For a ${providerName}-owned domain, pick the other option above.`
                : ""}
            </p>
          </div>
        ))}

      {/* Pinned to the bottom of the dialog's scroll area so the actions are
          always reachable, matching the create-link dialog. */}
      <div className="sticky bottom-0 z-10 -mx-1 -mb-1 flex items-center justify-end gap-2 border-t border-sidebar-border bg-background px-1 pt-3 pb-1">
        {cancelSlot}
        <Button type="submit" disabled={!canSubmit}>
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRightLeft className="h-4 w-4" />
          )}
          {typeof disabledUntilSeconds === "number" && disabledUntilSeconds > 0
            ? `Try again in ${disabledUntilSeconds}s`
            : isSubmitting
              ? "Starting migration"
              : "Start migration"}
        </Button>
      </div>
    </form>
  );
};

export default StartStep;
