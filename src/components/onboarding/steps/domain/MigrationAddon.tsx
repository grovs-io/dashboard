"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { IS_SELF_HOSTED } from "@/lib/edition";
import CredentialsFields, {
  APPSFLYER_EMPTY,
  BRANCH_EMPTY,
  type AppsflyerValues,
  type BranchValues,
} from "@/components/migration/CredentialsFields";
import { buildCreateMigrationPayload } from "@/components/migration/migrationPayload";
import {
  credentialsSchemaFor,
  migrationOldHostSchema,
} from "@/schemas/migration";
import type { CreateMigrationPayload, MigrationProvider } from "@/types";
import {
  ErrorText,
  FieldLabel,
  Hint,
  RadioDot,
  Segmented,
  SetupInput,
  TextLink,
} from "../../primitives";

export interface MigrationDraft {
  enabled: boolean;
  provider: MigrationProvider;
  hostname: string;
  providerHosted: boolean;
  branch: BranchValues;
  appsflyer: AppsflyerValues;
}

export const EMPTY_MIGRATION: MigrationDraft = {
  enabled: false,
  provider: "branch",
  hostname: "",
  providerHosted: false,
  branch: BRANCH_EMPTY,
  appsflyer: APPSFLYER_EMPTY,
};

const credentialsOf = (d: MigrationDraft) =>
  d.provider === "branch"
    ? { branch_key: d.branch.branch_key.trim() }
    : {
        onelink_id: d.appsflyer.onelink_id.trim(),
        api_token: d.appsflyer.api_token.trim(),
      };

export function migrationDraftValid(d: MigrationDraft): boolean {
  return (
    migrationOldHostSchema.safeParse(d.hostname.trim()).success &&
    credentialsSchemaFor(d.provider).safeParse(credentialsOf(d)).success
  );
}

export function migrationPayload(d: MigrationDraft): CreateMigrationPayload {
  return buildCreateMigrationPayload({
    provider: d.provider,
    hostname: d.hostname.trim(),
    credentials: credentialsOf(d) as CreateMigrationPayload["credentials"],
    providerHosted: IS_SELF_HOSTED && d.providerHosted,
    extraHosts: [],
  });
}

const PROVIDER_LABEL: Record<MigrationProvider, string> = {
  branch: "Branch",
  appsflyer: "AppsFlyer",
};

/** "Also bring my old links": the migration start form, folded under the domain choice. */
export const MigrationAddon = ({
  draft,
  onChange,
  needsPlan,
  onViewPlans,
  error,
}: {
  draft: MigrationDraft;
  onChange: (next: MigrationDraft) => void;
  needsPlan: boolean;
  onViewPlans: () => void;
  error?: string | null;
}) => {
  const [showBranchKey, setShowBranchKey] = useState(false);
  const [showApiToken, setShowApiToken] = useState(false);
  const name = PROVIDER_LABEL[draft.provider];
  const host = draft.hostname.trim() || "links.yourcompany.com";
  const hostInvalid =
    draft.hostname.trim().length > 0 &&
    !migrationOldHostSchema.safeParse(draft.hostname.trim()).success;
  const set = (patch: Partial<MigrationDraft>) =>
    onChange({ ...draft, ...patch });

  return (
    <div className="mt-[26px] max-w-[560px] border-t border-border pt-4">
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={draft.enabled}
          onChange={(e) => set({ enabled: e.target.checked })}
        />
        <span
          aria-hidden
          className={cn(
            "grid size-4 place-items-center rounded-[4px] border-[1.5px] border-foreground/20 text-background peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
            draft.enabled && "border-foreground bg-foreground"
          )}
        >
          {draft.enabled && <Check className="size-3 stroke-[3]" />}
        </span>
        Also bring my old links from Branch or AppsFlyer
        <span className="ml-auto hidden text-[13px] text-muted-foreground sm:inline">
          Optional · paid plans
        </span>
      </label>

      {draft.enabled && (
        <div className="mt-3.5 sm:ml-[26px]">
          {needsPlan ? (
            <Hint className="mt-0">
              Bringing old links over needs a paid plan.{" "}
              <TextLink onClick={onViewPlans}>View plans</TextLink>
            </Hint>
          ) : (
            <>
              <Segmented
                label="Provider"
                size="sm"
                value={draft.provider}
                onChange={(provider) => set({ provider })}
                options={[
                  { value: "branch", label: "Branch" },
                  { value: "appsflyer", label: "AppsFlyer" },
                ]}
                className="mb-4"
              />
              <FieldLabel htmlFor="onb-migration-host">
                Your current link domain
              </FieldLabel>
              <SetupInput
                id="onb-migration-host"
                tone="plain"
                value={draft.hostname}
                onChange={(hostname) =>
                  set({ hostname: hostname.toLowerCase() })
                }
                placeholder="links.yourcompany.com"
                invalid={hostInvalid}
                inputMode="url"
              />
              {hostInvalid && (
                <ErrorText>
                  {migrationOldHostSchema.safeParse(draft.hostname.trim()).error
                    ?.issues[0]?.message ?? "Enter a hostname"}
                </ErrorText>
              )}

              <div className="mt-4">
                <span className="mb-[7px] block text-[13px] font-medium">
                  Who controls that domain&apos;s DNS?
                </span>
                <div className="overflow-hidden rounded-[9px] border border-foreground/[0.11]">
                  {[
                    {
                      hosted: false,
                      title: "You do",
                      text: `A domain like ${host} that you pointed at ${name}. You'll switch its DNS to Grovs at the end.`,
                    },
                    {
                      hosted: true,
                      title: `${name} does`,
                      text: `A ${name} domain like ${draft.provider === "branch" ? "yourapp.app.link" : "yourapp.onelink.me"}. Only on self-hosted Grovs, because the DNS can't be moved.`,
                    },
                  ].map((option) => {
                    const disabled = option.hosted && !IS_SELF_HOSTED;
                    const on = draft.providerHosted === option.hosted;
                    return (
                      <button
                        key={option.title}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        disabled={disabled}
                        onClick={() => set({ providerHosted: option.hosted })}
                        className="grid w-full grid-cols-[18px_1fr] gap-2.5 border-t border-border px-3 py-2.5 text-left text-[13.5px] first:border-t-0 disabled:opacity-55"
                      >
                        <RadioDot on={on} />
                        <span>
                          {option.title}
                          <small className="mt-px block text-[12.5px] text-muted-foreground">
                            {option.text}
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                <CredentialsFields
                  provider={draft.provider}
                  idPrefix="onboarding"
                  branchValues={draft.branch}
                  appsflyerValues={draft.appsflyer}
                  showBranchKey={showBranchKey}
                  showApiToken={showApiToken}
                  onBranchChange={(branch) => set({ branch })}
                  onAppsflyerChange={(appsflyer) => set({ appsflyer })}
                  onToggleBranchKey={() => setShowBranchKey((v) => !v)}
                  onToggleApiToken={() => setShowApiToken((v) => !v)}
                />
              </div>
              {error && <ErrorText>{error}</ErrorText>}

              <div className="mt-[18px] text-[13px] text-muted-foreground">
                <b className="mb-1 block font-medium text-foreground/80">
                  What happens next
                </b>
                <ol className="list-decimal pl-[18px] leading-[1.7]">
                  {draft.providerHosted ? (
                    <>
                      <li>
                        Links opened in your app resolve through the Grovs SDK.
                      </li>
                      <li>Web clicks keep going to {name}. No DNS changes.</li>
                    </>
                  ) : (
                    <>
                      <li>
                        We add{" "}
                        <code className="font-mono">applinks:{host}</code> to
                        your app setup in step 2.
                      </li>
                      <li>
                        You ship that app build to the App Store and Google
                        Play.
                      </li>
                      <li>
                        You point {host}&apos;s DNS at Grovs. Old links keep
                        opening your app.
                      </li>
                    </>
                  )}
                </ol>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
