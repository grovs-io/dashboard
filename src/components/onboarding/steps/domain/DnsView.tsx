"use client";

import { useEffect, useState } from "react";
import {
  useCustomDomainEnvelopeQuery,
  useCustomDomainPreflightQuery,
} from "@/hooks/queries/useConfigurationQueries";
import {
  CUSTOM_DOMAIN_PREFLIGHT_POLL_MS,
  isCustomDomainFailedLike,
  isManualCustomDomainMode,
  preflightCnameVerdict,
} from "@/lib/customDomainStatus";
import { sslValidationTxtRecordsFor } from "@/lib/dnsTxtRecords";
import { normalizeVerificationErrors } from "@/lib/verificationErrors";
import { FLAT_PLANS } from "@/types/payment";
import type { CustomDomain, Subscription } from "@/types";
import {
  CopyChip,
  DocLink,
  FooterSpacer,
  HelpDocs,
  HelpLinks,
  HelpPitfalls,
  HelpTitle,
  Hint,
  Lead,
  OkMark,
  PendingMark,
  PrimaryButton,
  Spinner,
  StepPage,
  StepTitle,
  docsUrl,
} from "../../primitives";

export interface DnsRecordRow {
  type: string;
  name: string;
  value: string;
}

/** The records the customer must publish, with fully-qualified names. */
export function dnsRecordsFor(
  domain: CustomDomain,
  manual: boolean
): DnsRecordRow[] {
  if (manual && domain.setup_records?.length) {
    return domain.setup_records
      .filter((r) => r.name && r.value)
      .map((r) => ({
        type: r.type ?? "CNAME",
        name: r.name!,
        value: r.value!,
      }));
  }
  const rows: DnsRecordRow[] = [];
  if (domain.cname_target) {
    rows.push({
      type: "CNAME",
      name: domain.hostname,
      value: domain.cname_target,
    });
  }
  if (
    domain.ownership_verification_txt_name &&
    domain.ownership_verification_txt_value
  ) {
    rows.push({
      type: "TXT",
      name: domain.ownership_verification_txt_name,
      value: domain.ownership_verification_txt_value,
    });
  }
  sslValidationTxtRecordsFor(domain).forEach((r) =>
    rows.push({ type: "TXT", name: r.name, value: r.value })
  );
  return rows;
}

export const recordsMailto = (hostname: string, records: DnsRecordRow[]) =>
  `mailto:?subject=${encodeURIComponent(`DNS records for ${hostname}`)}&body=${encodeURIComponent(
    `Please add these DNS records so ${hostname} serves our Grovs links:\n\n${records
      .map((r) => `${r.type}  ${r.name}  ${r.value}`)
      .join("\n")}\n`
  )}`;

const secondsSince = (iso: number) =>
  Math.max(0, Math.round((Date.now() - iso) / 1000));

/** "Point links.example.com to Grovs": records, live CNAME/HTTPS status, help. */
export const DnsView = ({
  projectId,
  subscription,
  onContinue,
}: {
  projectId: string | undefined;
  subscription: Subscription | null | undefined;
  onContinue: () => void;
}) => {
  const envelope = useCustomDomainEnvelopeQuery(projectId);
  const domain = envelope.data?.custom_domain ?? null;
  const manual = isManualCustomDomainMode(envelope.data?.tls_mode);
  const preflight = useCustomDomainPreflightQuery(projectId, domain?.hostname, {
    enabled: !!domain && !manual,
    refetchInterval: (query) =>
      preflightCnameVerdict(query.state.data) === "matched"
        ? false
        : CUSTOM_DOMAIN_PREFLIGHT_POLL_MS,
  });
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const hostname = domain?.hostname ?? "your domain";
  const records = domain ? dnsRecordsFor(domain, manual) : [];
  const cnameOk = manual
    ? domain?.status === "active"
    : preflightCnameVerdict(preflight.data) === "matched";
  const httpsOk =
    domain?.ssl_status === "active" || (manual && domain?.status === "active");
  const failed = domain ? isCustomDomainFailedLike(domain) : false;
  const errors = domain
    ? normalizeVerificationErrors(domain.verification_errors)
    : [];
  const plan = FLAT_PLANS.find((p) => p.key === subscription?.plan);

  const left = (
    <>
      <div className="mb-2 text-[12.5px] text-muted-foreground">
        Link domain · last part
      </div>
      <StepTitle>Point {hostname} to Grovs</StepTitle>
      <Lead>
        Add these records where you manage DNS for your domain (Cloudflare,
        GoDaddy, Route 53…). We check every few seconds and set up HTTPS for
        you.
      </Lead>

      {plan && (
        <div className="mb-[22px] flex max-w-[560px] items-center gap-2.5 rounded-[9px] border border-valid-green/30 bg-valid-green/[0.06] px-3 py-2.5 text-[13.5px]">
          <OkMark />
          {plan.name} {plan.cap} active
          <span className="ml-auto hidden text-[12.5px] text-muted-foreground sm:inline">
            Receipt sent by email
          </span>
        </div>
      )}

      {envelope.isLoading ? (
        <div className="h-28 max-w-[600px] animate-pulse rounded-[10px] bg-muted" />
      ) : records.length > 0 ? (
        <div className="max-w-[600px] overflow-hidden rounded-[10px] border border-foreground/[0.11] text-[13px]">
          <div className="grid grid-cols-[52px_minmax(0,1fr)_42px] gap-2.5 border-b border-border bg-muted px-3.5 py-2.5 text-xs text-muted-foreground sm:grid-cols-[62px_minmax(0,190px)_minmax(0,1fr)_42px] dark:bg-white/[0.03]">
            <span>Type</span>
            <span>Name</span>
            <span className="hidden sm:block">Value</span>
            <span />
          </div>
          {records.map((r) => (
            <div
              key={`${r.type}-${r.name}-${r.value}`}
              className="grid grid-cols-[52px_minmax(0,1fr)_42px] items-center gap-2.5 border-t border-border px-3.5 py-2.5 [&:nth-child(2)]:border-t-0 sm:grid-cols-[62px_minmax(0,190px)_minmax(0,1fr)_42px]"
            >
              <b className="font-medium">{r.type}</b>
              <code className="font-mono text-[12.5px] break-all">
                {r.name}
              </code>
              <code className="col-start-2 font-mono text-[12.5px] break-all text-foreground/80 sm:col-start-auto sm:text-foreground">
                {r.value}
              </code>
              <span className="col-start-3 row-start-1 text-right sm:col-start-auto sm:row-start-auto">
                <CopyChip value={r.value} bare />
              </span>
            </div>
          ))}
        </div>
      ) : (
        <Hint className="max-w-[600px]">
          Preparing your records. They appear here within a few seconds.
        </Hint>
      )}

      <Hint className="max-w-[600px]">
        Using Cloudflare? Set the CNAME to{" "}
        <b className="font-medium text-foreground/80">DNS only</b> (grey cloud),
        not proxied. Changes usually show up within minutes, sometimes up to an
        hour.
      </Hint>

      <div className="mt-[18px] max-w-[600px] text-[13.5px]">
        <div className="flex items-center gap-2.5 border-y border-border py-[11px]">
          {cnameOk ? <OkMark /> : <Spinner />}
          {cnameOk ? "CNAME record found" : "Waiting for the CNAME record"}
          {!cnameOk && preflight.dataUpdatedAt > 0 && (
            <span className="ml-auto text-[12.5px] text-muted-foreground">
              checked {secondsSince(preflight.dataUpdatedAt)} s ago
            </span>
          )}
        </div>
        <div className="flex items-center gap-2.5 border-b border-border py-[11px]">
          {httpsOk ? <OkMark /> : <PendingMark />}
          <span className={httpsOk ? undefined : "text-muted-foreground"}>
            HTTPS certificate
          </span>
          <span className="ml-auto text-[12.5px] text-muted-foreground">
            {httpsOk ? "active" : "after DNS"}
          </span>
        </div>
      </div>
      {failed && errors.length > 0 && (
        <p className="mt-3 max-w-[600px] text-[12.5px] text-destructive">
          {errors.join(" ")}
        </p>
      )}
    </>
  );

  const right = (
    <HelpDocs>
      <HelpTitle>Where to add the records</HelpTitle>
      <ol>
        <li>Sign in to the service that hosts DNS for your domain.</li>
        <li>
          Open <b>DNS</b> / <b>DNS records</b> and choose <b>Add record</b>.
        </li>
        <li>Add the rows exactly as shown. Leave TTL on Auto.</li>
      </ol>
      <HelpPitfalls
        items={[
          "Names are shown in full. If your provider adds your domain to the name itself, enter only the part before it.",
          "Cloudflare proxy (orange cloud) left on.",
          <>
            An old CNAME or A record for{" "}
            <code>{records[0]?.name ?? "the name"}</code> still there: remove it
            first.
          </>,
        ]}
      />
      <HelpLinks>
        <a
          href={recordsMailto(hostname, records)}
          className="text-foreground underline decoration-foreground/25 underline-offset-[3px] hover:decoration-foreground/60"
        >
          Send these records to a teammate
        </a>
        <DocLink href={docsUrl("/docs")}>Grovs docs</DocLink>
      </HelpLinks>
    </HelpDocs>
  );

  return (
    <StepPage
      left={left}
      right={right}
      footer={
        <>
          <span className="hidden text-[13.5px] text-muted-foreground sm:inline">
            {cnameOk && httpsOk
              ? "Your domain is live."
              : "You can continue now; we'll keep checking."}
          </span>
          <FooterSpacer />
          <PrimaryButton onClick={onContinue}>Continue</PrimaryButton>
        </>
      }
    />
  );
};
