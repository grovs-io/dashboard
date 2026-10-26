"use client";

import { AutoWidthInput } from "@/components/common/AutoWidthInput";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Phone as PhoneIcon } from "lucide-react";
import { queryKeys } from "@/lib/queryKeys";
import { showGenericError } from "@/lib/Notifications";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/apiErrorHelpers";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useDomainConfigQuery,
  useDomainDefaultsQuery,
} from "@/hooks/queries/useConfigurationQueries";
import {
  useAddCustomDomainMutation,
  useSetSubdomainMutation,
  useVerifySubdomainMutation,
} from "@/hooks/mutations/useConfigurationMutations";
import { useCreateMigrationMutation } from "@/hooks/mutations/useMigrationMutations";
import { useMigrationSourceQuery } from "@/hooks/queries/useMigrationQueries";
import {
  isLikelySubdomain,
  subdomainIssue,
} from "@/components/configuration/CustomDomainDialog";
import ScaleUpDialog from "@/components/settings/ScaleUpDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSubscriptionQuery } from "@/hooks/queries/usePaymentsQueries";
import type { DomainConfig, Instance } from "@/types";
import type { PlanChoice } from "@/types/payment";
import {
  ChoiceRow,
  ChoiceRows,
  ErrorText,
  FooterSpacer,
  Hint,
  Lead,
  PanelCaption,
  PrimaryButton,
  StepPage,
  StepTitle,
  TextLink,
} from "../../primitives";
import { MessagePreview } from "../../previews/Phone";
import {
  MIN_SUBDOMAIN_LENGTH,
  sanitizeSubdomain,
  subdomainIdeas,
} from "../../setupRules";
import type { SetupData } from "../../useSetupData";
import { PlanList, planLabel } from "./PlanList";
import {
  EMPTY_MIGRATION,
  MigrationAddon,
  migrationDraftValid,
  migrationPayload,
  type MigrationDraft,
} from "./MigrationAddon";
import { DnsView } from "./DnsView";

type Choice = "grovs" | "own";

// Keeps the project's social preview fields: the domain PUT replaces them.
// Omits generic_image_url: re-sending it purges an uploaded image.
function subdomainForm(domain: DomainConfig, subdomain: string): FormData {
  const form = new FormData();
  form.append("subdomain", subdomain);
  if (domain.generic_title) form.append("generic_title", domain.generic_title);
  if (domain.generic_subtitle)
    form.append("generic_subtitle", domain.generic_subtitle);
  if (domain.google_tracking_id)
    form.append("google_tracking_id", domain.google_tracking_id);
  return form;
}

/** Live preview of how a link on the chosen domain looks in iMessage. */
export const SharePreviewPhone = ({
  instance,
  host,
  title,
  imageUrl,
}: {
  instance: Instance;
  host: string;
  title?: string;
  imageUrl?: string | null;
}) => {
  const prodId = instance.production?.id;
  const { data: domain } = useDomainConfigQuery(prodId);
  const { data: defaults } = useDomainDefaultsQuery(prodId);
  return (
    <>
      <PanelCaption>How your links look when shared</PanelCaption>
      <MessagePreview
        projectName={instance.production?.name ?? instance.name}
        title={
          title || domain?.generic_title || defaults?.generic_title || "grovs"
        }
        host={host}
        imageUrl={
          imageUrl ??
          domain?.generic_image_url ??
          defaults?.generic_image_url ??
          null
        }
      />
    </>
  );
};

const OldLinkFlow = ({
  host,
  provider,
}: {
  host: string;
  provider: string;
}) => (
  <>
    <PanelCaption>What happens to an old link</PanelCaption>
    <div className="flex w-full max-w-[400px] flex-col gap-3">
      {[
        {
          icon: <PhoneIcon />,
          title: "Someone opens an old link",
          text: `${host}/abc123`,
        },
        {
          icon: <ArrowRight />,
          title: `Grovs looks it up once in ${provider}`,
          text: `using your ${provider} key`,
        },
        {
          icon: <Check />,
          title: "It opens your app as before",
          text: "every later open is instant",
        },
      ].map((row) => (
        <div
          key={row.title}
          className="grid grid-cols-[36px_1fr] items-center gap-3 rounded-[10px] border border-border bg-background px-3.5 py-3 text-[13px]"
        >
          <span className="grid size-9 place-items-center rounded-[9px] bg-foreground/[0.05] text-foreground/75 [&_svg]:size-4">
            {row.icon}
          </span>
          <span className="min-w-0">
            <b className="block text-[13.5px] font-medium">{row.title}</b>
            <span className="font-mono text-xs text-foreground/75">
              {row.text}
            </span>
          </span>
        </div>
      ))}
    </div>
  </>
);

/** Step 1: pick the link domain (Grovs subdomain or your own), optionally bring old links. */
export const DomainStep = ({
  instance,
  data,
  onDone,
  markDone,
}: {
  instance: Instance;
  data: SetupData;
  onDone: () => void;
  markDone: () => void;
}) => {
  const prod = instance.production;
  const test = instance.test;
  const queryClient = useQueryClient();
  const { data: prodDomain } = useDomainConfigQuery(prod?.id);
  const { data: testDomain } = useDomainConfigQuery(test?.id);
  const subscription = useSubscriptionQuery(instance.id).data?.subscription;
  const migrationSource = useMigrationSourceQuery(prod?.id);

  const setProdSubdomain = useSetSubdomainMutation(prod?.id);
  const setTestSubdomain = useSetSubdomainMutation(test?.id);
  const verifyProd = useVerifySubdomainMutation(prod?.id);
  const verifyTest = useVerifySubdomainMutation(test?.id);
  const addDomain = useAddCustomDomainMutation(prod?.id);
  const createMigration = useCreateMigrationMutation(prod?.id);

  const primary = data.primaryDomain;
  const [view, setView] = useState<"choose" | "dns">(
    primary ? "dns" : "choose"
  );
  const [choice, setChoice] = useState<Choice>(primary ? "own" : "grovs");
  const [subdomain, setSubdomain] = useState("");
  const [hostname, setHostname] = useState(primary?.hostname ?? "");
  const [plan, setPlan] = useState<PlanChoice>({
    plan: "growth_250k",
    interval: "yearly",
  });
  const [migration, setMigration] = useState<MigrationDraft>(EMPTY_MIGRATION);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<PlanChoice | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Seed once from the server; later edits are the user's.
  const savedSubdomain = prodDomain?.subdomain;
  const [seeded, setSeeded] = useState(false);
  if (savedSubdomain !== undefined && !seeded) {
    setSeeded(true);
    setSubdomain(savedSubdomain);
  }

  const debounced = useDebouncedValue(subdomain, 350);
  const [availability, setAvailability] = useState<{
    value: string;
    available: boolean;
    failed?: boolean;
  } | null>(null);
  const { mutateAsync: verify } = verifyProd;
  useEffect(() => {
    if (savedSubdomain === undefined) return;
    if (debounced.length < MIN_SUBDOMAIN_LENGTH || debounced === savedSubdomain)
      return;
    let live = true;
    verify(debounced)
      .then(
        (r) =>
          live &&
          setAvailability({ value: debounced, available: r.data.available })
      )
      .catch(
        () =>
          live &&
          setAvailability({ value: debounced, available: false, failed: true })
      );
    return () => {
      live = false;
    };
  }, [debounced, savedSubdomain, verify]);

  const changed = !!prodDomain && subdomain !== prodDomain.subdomain;
  const tooShort = subdomain.length < MIN_SUBDOMAIN_LENGTH;
  // The saved name is always available to keep.
  const checked = !changed || availability?.value === subdomain;
  const available =
    !tooShort && checked && (!changed || availability!.available);
  const unavailable =
    !tooShort && checked && changed && !availability!.available;
  const checkFailed = unavailable && !!availability!.failed;
  const taken = unavailable && !checkFailed;
  const ideas = subdomainIdeas(prod?.name ?? instance.name, subdomain);

  const ownAllowed = data.customDomainsAvailable;
  const hostnameValid = isLikelySubdomain(hostname.trim());
  // Explain a rejected value once typing pauses, so it doesn't flash mid-word.
  const settledHostname = useDebouncedValue(hostname, 600);
  const hostIssue =
    settledHostname === hostname ? subdomainIssue(hostname) : null;
  const needsPayment = choice === "own" && !data.hasPaidPlan;
  const migrationExists = !!migrationSource.data;
  const showMigration = !migrationExists && choice === "grovs";
  const migrationBlocked =
    showMigration && migration.enabled && !data.hasPaidPlan;

  const canContinue =
    choice === "grovs"
      ? available &&
        (!migration.enabled ||
          !showMigration ||
          migrationBlocked ||
          migrationDraftValid(migration))
      : hostnameValid && !data.planLoading;

  const previewHost =
    choice === "own" && hostname.trim()
      ? hostname.trim()
      : `${subdomain || prodDomain?.subdomain || "yourapp"}.${prodDomain?.domain ?? "sqd.link"}`;

  const saveSubdomain = async () => {
    if (!prodDomain || !changed) return;
    await setProdSubdomain.mutateAsync(subdomainForm(prodDomain, subdomain));
    // The test project mirrors the name when it's free there too.
    if (testDomain && testDomain.subdomain !== subdomain) {
      try {
        const r = await verifyTest.mutateAsync(subdomain);
        if (r.data.available)
          await setTestSubdomain.mutateAsync(
            subdomainForm(testDomain, subdomain)
          );
      } catch {
        // The test domain keeps its own name.
      }
    }
  };

  const continueGrovs = async () => {
    setSaving(true);
    setMigrationError(null);
    try {
      await saveSubdomain();
    } catch {
      setSaving(false);
      showGenericError();
      return;
    }
    if (showMigration && migration.enabled && !migrationBlocked) {
      try {
        await createMigration.mutateAsync(migrationPayload(migration));
      } catch (err) {
        setSaving(false);
        setMigrationError(
          getApiErrorMessage(
            err,
            "Couldn't start bringing your old links over. Check the details and try again."
          )
        );
        return;
      }
    }
    setSaving(false);
    markDone();
    onDone();
  };

  const addHostname = async () => {
    const value = hostname.trim().toLowerCase();
    if (primary?.hostname === value) {
      setView("dns");
      return;
    }
    setSaving(true);
    setHostError(null);
    try {
      await addDomain.mutateAsync({ hostname: value, purpose: "primary" });
      setView("dns");
    } catch (err) {
      const status = getApiErrorStatus(err);
      if (status === 402) setCheckout(plan);
      else
        setHostError(
          getApiErrorMessage(
            err,
            status === 409
              ? "A custom domain is already set up for this project."
              : "Enter a subdomain you control, like links.yourcompany.com."
          )
        );
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = () => {
    if (choice === "own") {
      if (needsPayment) setCheckout(plan);
      else void addHostname();
      return;
    }
    if (changed && data.signals.hasLinks) setConfirmOpen(true);
    else void continueGrovs();
  };

  if (view === "dns") {
    return (
      <DnsView
        projectId={prod?.id}
        subscription={subscription}
        onContinue={() => {
          markDone();
          onDone();
        }}
      />
    );
  }

  const left = (
    <>
      <StepTitle>Choose your link domain</StepTitle>
      <Lead>
        Every link starts with this address. Your app gets set up to open it in
        the next step, so it&apos;s chosen first.
      </Lead>

      <ChoiceRows className="max-w-[560px]">
        <ChoiceRow
          selected={choice === "grovs"}
          onSelect={() => setChoice("grovs")}
          title="Grovs domain"
          subtitle="Ready right away"
          aside="Free"
        >
          <label className="flex h-[46px] items-center rounded-[10px] border border-chart-users bg-background px-4 font-mono text-[15px] ring-3 ring-chart-users/15 sm:text-base">
            <span className="text-muted-foreground select-none">https://</span>
            <AutoWidthInput
              aria-label="Subdomain"
              value={subdomain}
              onChange={(e) => setSubdomain(sanitizeSubdomain(e.target.value))}
              className="font-semibold text-foreground"
            />
            <span className="truncate text-muted-foreground select-none">
              .{prodDomain?.domain ?? "sqd.link"}
            </span>
            {available && (
              <span
                role="img"
                aria-label="Available"
                className="ml-auto grid size-5 shrink-0 place-items-center rounded-full bg-valid-green/12 text-valid-green"
              >
                <Check className="size-3 stroke-[2.6]" />
              </span>
            )}
          </label>
          {tooShort && subdomain.length > 0 ? (
            <ErrorText>
              Use at least {MIN_SUBDOMAIN_LENGTH} characters.
            </ErrorText>
          ) : checkFailed ? (
            <ErrorText>Couldn&apos;t check this name. Try again.</ErrorText>
          ) : taken ? (
            <ErrorText>That name is taken. Try another one.</ErrorText>
          ) : ideas.length > 0 ? (
            <Hint className="mb-0">
              Ideas:{" "}
              {ideas.map((idea, i) => (
                <span key={idea}>
                  {i > 0 && " · "}
                  <TextLink onClick={() => setSubdomain(idea)}>{idea}</TextLink>
                </span>
              ))}
            </Hint>
          ) : null}
          {changed && data.signals.hasLinks && (
            <Hint>Links you already made stop working on the old name.</Hint>
          )}
        </ChoiceRow>
        {ownAllowed && (
          <ChoiceRow
            selected={choice === "own"}
            onSelect={() => setChoice("own")}
            title="Your own domain"
            subtitle="Like links.yourcompany.com"
            aside={data.hasPaidPlan ? "Included" : "Paid plans"}
          >
            <label className="flex h-[46px] items-center rounded-[10px] border border-chart-users bg-background px-4 font-mono text-[15px] ring-3 ring-chart-users/15 sm:text-base">
              <span className="text-muted-foreground select-none">
                https://
              </span>
              <input
                aria-label="Your domain"
                value={hostname}
                placeholder="links.yourcompany.com"
                onChange={(e) => {
                  setHostname(e.target.value.toLowerCase().replace(/\s/g, ""));
                  setHostError(null);
                }}
                spellCheck={false}
                autoCapitalize="off"
                className="min-w-0 flex-1 bg-transparent font-semibold text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/50"
              />
            </label>
            {hostError ? (
              <ErrorText>{hostError}</ErrorText>
            ) : hostIssue ? (
              <ErrorText>
                {hostIssue.message}
                {hostIssue.apex && (
                  <>
                    {" "}
                    <TextLink
                      className="text-destructive decoration-destructive/40"
                      onClick={() => setHostname(`links.${hostIssue.apex}`)}
                    >
                      Use links.{hostIssue.apex}
                    </TextLink>
                  </>
                )}
              </ErrorText>
            ) : (
              <Hint>
                A subdomain you own. You&apos;ll add one DNS record
                {needsPayment ? " after paying" : " next"}.
              </Hint>
            )}
            {needsPayment && <PlanList value={plan} onChange={setPlan} />}
          </ChoiceRow>
        )}
      </ChoiceRows>

      {showMigration && (
        <MigrationAddon
          draft={migration}
          onChange={(next) => {
            setMigration(next);
            setMigrationError(null);
          }}
          needsPlan={!data.hasPaidPlan}
          onViewPlans={() => setPlansOpen(true)}
          error={migrationError}
        />
      )}
    </>
  );

  const right =
    showMigration && migration.enabled && !migrationBlocked ? (
      <OldLinkFlow
        host={migration.hostname.trim() || "links.yourcompany.com"}
        provider={migration.provider === "branch" ? "Branch" : "AppsFlyer"}
      />
    ) : (
      <SharePreviewPhone instance={instance} host={previewHost} />
    );

  return (
    <>
      <StepPage
        left={left}
        right={right}
        footer={
          <>
            {needsPayment && (
              <span className="hidden text-[13.5px] text-muted-foreground sm:inline">
                {planLabel(plan)}
              </span>
            )}
            <FooterSpacer />
            <PrimaryButton
              disabled={!canContinue || saving}
              onClick={handleContinue}
            >
              {needsPayment ? "Continue to payment" : "Continue"}
            </PrimaryButton>
          </>
        }
      />
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change your link domain?</AlertDialogTitle>
            <AlertDialogDescription>
              Links you already made use the old name and stop working. Apps
              already released need an update for the new name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void continueGrovs()}>
              Change domain
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {checkout && (
        <ScaleUpDialog
          open
          initialChoice={checkout}
          onOpenChange={(open) => !open && setCheckout(null)}
          onPurchased={() => {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.payments.subscription(instance.id),
            });
            void addHostname();
          }}
        />
      )}
      <ScaleUpDialog open={plansOpen} onOpenChange={setPlansOpen} />
    </>
  );
};
