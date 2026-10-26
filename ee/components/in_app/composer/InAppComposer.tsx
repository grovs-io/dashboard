"use client";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import ActionConfirm from "@/components/common/action-confirm";
import ComposerNav from "@/components/composer/ComposerNav";
import { FieldError } from "@/components/common/FieldError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { cn } from "@/lib/utils";
import { inAppApi } from "@ee/api/in_app/inAppService";
import { inAppErrorText, launchSentence } from "@ee/lib/inApp";
import { mediaProblem } from "@ee/lib/inAppHtml";
import {
  IN_APP_SECTIONS,
  SECTION_LABELS,
  draftFromCampaign,
  draftInput,
  draftName,
  alertLimitProblems,
  draftProblems,
  draftWarnings,
  emptyDraft,
  addVariant,
  firstProblemSection,
  hasProblems,
  nextVariantId,
  patchVariant,
  problemVariant,
  variantOf,
  questionTemplateProblem,
  removeVariant,
  withVariant,
  type InAppDraft,
  type InAppSection,
  type VariantKey,
} from "@ee/lib/inAppComposer";
import {
  useInAppImage,
  useInAppStep,
  useInAppTest,
  useSaveInAppCampaign,
} from "@ee/hooks/mutations/useInAppMutations";
import { useInAppSuggestions } from "@ee/hooks/queries/useInAppSuggestions";
import { useInAppSettingsQuery } from "@ee/hooks/queries/useInAppQueries";
import SplitOverview from "@ee/components/experiments/SplitOverview";
import { useSegmentsQuery } from "@ee/hooks/queries/useSegmentsQueries";
import InAppSummary from "@ee/components/in_app/InAppSummary";
import type {
  InAppCampaign,
  InAppImageSlot,
  InAppMedia,
  InAppVariantId,
} from "@ee/types/inApp";
import VariantBar from "@ee/components/experiments/VariantBar";
import AudienceSection from "./AudienceSection";
import ExperimentSection from "./ExperimentSection";
import LimitsSection from "./LimitsSection";
import PreviewPanel from "./PreviewPanel";
import MessageSection, { IMAGE_MAX_BYTES } from "./MessageSection";
import TriggerSection from "./TriggerSection";
import {
  CampaignMedia,
  NOT_SAVED,
  UploadRefused,
  WAIT,
  campaignMediaKey,
} from "./html/MediaPanel";

export type CloseRef = MutableRefObject<(() => void) | null>;

interface Props {
  projectId: string;
  initial?: InAppCampaign;
  // A ready-made start, for a new message only.
  preset?: InAppDraft;
  closeRef: CloseRef;
  onClose: () => void;
}

const SECTION_META: Record<InAppSection, string> = {
  message: "What people see, and what they can do with it.",
  trigger: "What has to happen in the app for the message to show.",
  audience: "Who may see it, and on which devices.",
  experiment:
    "Measure what the message does: a goal to count, a control group to compare with, and, if you add variants in the Message step, which version wins.",
  limits: "How often it shows, and when it runs.",
  review: "Read it through once before it goes live.",
};

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif"];

export default function InAppComposer({
  projectId,
  initial,
  preset,
  closeRef,
  onClose,
}: Props) {
  const [draft, setDraft] = useState<InAppDraft>(() =>
    initial ? draftFromCampaign(initial) : (preset ?? emptyDraft())
  );
  const [saved, setSaved] = useState<InAppCampaign | null>(initial ?? null);
  const [dirty, setDirty] = useState(!initial && !!preset);
  const [section, setSection] = useState<InAppSection>("message");
  // Which variant the message step edits and the preview shows; not saved.
  const [chosen, setVariant] = useState<VariantKey>("a");
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<InAppImageSlot | null>(null);
  // Media uploads and deletes queued or running.
  const [mediaJobs, setMediaJobs] = useState(0);
  // The design window has its own preview; one live preview frame is enough.
  const [designing, setDesigning] = useState(false);
  // The chosen file itself, so the picture shows at once and whatever address the server gives it.
  const [local, setLocal] = useState<Partial<Record<InAppImageSlot, string>>>(
    {}
  );
  const [confirmLaunch, setConfirmLaunch] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const client = useQueryClient();
  const save = useSaveInAppCampaign(projectId);
  const image = useInAppImage(projectId);
  const step = useInAppStep(projectId);
  const test = useInAppTest(projectId);
  const [tester, setTester] = useState("");
  const segments = useSegmentsQuery(projectId, false);
  const suggestions = useInAppSuggestions(projectId);
  // The project-wide control group comes off the top of every split.
  const projectControlGroup =
    useInAppSettingsQuery(projectId).data?.control_group ?? 0;

  // Counts edits, so a save knows whether anything was typed while it was on its way.
  const edits = useRef(0);

  const launched = !!saved && saved.status !== "draft";
  const busy =
    save.isPending ||
    step.isPending ||
    test.isPending ||
    uploading !== null ||
    mediaJobs > 0;
  // Parsing the HTML waits until typing leaves the browser time for it.
  const checked = useDeferredValue(draft);
  const problems = useMemo(() => draftProblems(checked), [checked]);
  const warnings = useMemo(() => draftWarnings(checked), [checked]);
  const segmentId =
    draft.audience.type === "segment" ? draft.audience.segmentId : undefined;
  const segmentName =
    segments.data?.segments.find((s) => s.id === segmentId)?.name ?? null;

  const set = (patch: Partial<InAppDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    edits.current += 1;
    setDirty(true);
    setError(null);
  };
  // A removed variant falls back to A.
  const variant =
    chosen === "a" || draft.variants.some((v) => v.id === chosen)
      ? chosen
      : "a";
  const setContent = (patch: Partial<InAppDraft>) => {
    setDraft((current) => patchVariant(current, variant, patch));
    edits.current += 1;
    setDirty(true);
    setError(null);
  };
  // Bound to the variant shown when called, so an upload lands on the variant it started on.
  const setHtml = (update: (html: string) => string) => {
    const on = variant;
    setDraft((current) =>
      patchVariant(current, on, {
        html: update(withVariant(current, on).html),
      })
    );
    edits.current += 1;
    setDirty(true);
    setError(null);
  };
  const onAddVariant = () => {
    setVariant(nextVariantId(draft));
    set(addVariant(draft, variant));
  };
  const onRemoveVariant = (id: InAppVariantId) => {
    if (mediaJobs > 0) return;
    setVariant("a");
    set(removeVariant(draft, id));
  };

  const blobs = useRef<string[]>([]);
  useEffect(() => {
    const made = blobs.current;
    return () => made.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    closeRef.current = () => (dirty ? setConfirmDiscard(true) : onClose());
    return () => {
      closeRef.current = null;
    };
  }, [closeRef, dirty, onClose]);

  // The newest saved campaign, for media changes that run after the render that queued them.
  const latest = useRef(saved);
  const adopt = (campaign: InAppCampaign) => {
    latest.current = campaign;
    setSaved(campaign);
  };

  const persist = async (): Promise<InAppCampaign | null> => {
    const sent = edits.current;
    const last = latest.current;
    try {
      const campaign = await save.mutateAsync({
        id: last?.id ?? null,
        input: {
          ...draftInput(draft, { withAudience: !launched }),
          // The version editing started from, or our own last write returned: another admin's save must 409.
          lock_version: last?.lock_version,
        },
      });
      adopt(campaign);
      // What was typed since the request left is not saved yet.
      setDirty(edits.current !== sent);
      return campaign;
    } catch (e) {
      setError(inAppErrorText(e, "Could not save the campaign."));
      return null;
    }
  };

  // Media changes run one at a time, so each sends the version the last one left; a save on its way would make it stale.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = <T,>(job: () => Promise<T>): Promise<T> => {
    if (busy && !mediaJobs) return Promise.reject(new UploadRefused(WAIT));
    setMediaJobs((n) => n + 1);
    const run = queue.current
      .then(job)
      .finally(() => setMediaJobs((n) => n - 1));
    queue.current = run.catch(() => undefined);
    return run;
  };

  // A file needs a campaign to belong to: the first upload to a new message saves it.
  const upload = (file: File) =>
    enqueue(async () => {
      const last = latest.current;
      const listed = last
        ? client.getQueryData<InAppMedia[]>(
            campaignMediaKey(projectId, last.id)
          )
        : undefined;
      const problem = mediaProblem(file, listed ?? []);
      if (problem) throw new UploadRefused(problem);
      const campaign = last ?? (await persist());
      if (!campaign) throw new UploadRefused(NOT_SAVED);
      const { media, lock_version } = (
        await inAppApi.uploadMedia(
          projectId,
          campaign.id,
          file,
          campaign.lock_version
        )
      ).data;
      adopt({ ...campaign, lock_version });
      client.setQueryData<InAppMedia[]>(
        campaignMediaKey(projectId, campaign.id),
        (old) => [...(old ?? []), media]
      );
      return media.url;
    });

  // Queued behind a running upload, as uploads are; refused while a save runs.
  const remove = (item: InAppMedia) =>
    enqueue(async () => {
      const campaign = latest.current!;
      const { lock_version } = (
        await inAppApi.removeMedia(
          projectId,
          campaign.id,
          item.id,
          campaign.lock_version
        )
      ).data;
      adopt({ ...campaign, lock_version });
      client.setQueryData<InAppMedia[]>(
        campaignMediaKey(projectId, campaign.id),
        (old) => (old ?? []).filter((m) => m.id !== item.id)
      );
    });

  const onImage = async (slot: InAppImageSlot, file: File | null) => {
    if (file && !IMAGE_TYPES.includes(file.type))
      return setError("The image must be a PNG, JPEG or GIF.");
    if (file && file.size > IMAGE_MAX_BYTES)
      return setError("The image must be under 1 MB.");
    // One at a time: two uploads to an unsaved message would each create a draft of their own.
    if (busy) return;
    setUploading(slot);
    const shown = local[slot];
    const picked = file ? URL.createObjectURL(file) : undefined;
    if (picked) blobs.current.push(picked);
    setLocal((images) => ({ ...images, [slot]: picked }));
    try {
      // An upload needs a campaign to belong to, and must not undo what was typed since the last save.
      const campaign = dirty || !saved ? await persist() : saved;
      if (!campaign) return;
      const next = await image.mutateAsync({ id: campaign.id, slot, file });
      adopt(next);
      setDraft((d) => ({
        ...d,
        image: { portrait: null, landscape: null, ...next.content.image },
      }));
    } catch (e) {
      setError(inAppErrorText(e, "Could not upload the image."));
      setLocal((images) => ({ ...images, [slot]: shown }));
    } finally {
      setUploading(null);
    }
  };

  const check = (): boolean => {
    // The draft itself, not the deferred one the steps show.
    const found = draftProblems(draft);
    if (!hasProblems(found)) return true;
    setShown(true);
    const first = firstProblemSection(found) ?? "message";
    setSection(first);
    if (first === "message") setVariant(problemVariant(found) ?? "a");
    return false;
  };

  const saveDraft = async () => {
    if (launched && !check()) return;
    // Saved without its segment, the audience would come back as everyone.
    if (draft.audience.type === "segment" && !draft.audience.segmentId) {
      setShown(true);
      setSection("audience");
      return;
    }
    const sent = edits.current;
    const campaign = await persist();
    if (!campaign) return;
    showSuccessNotification(launched ? "Changes saved" : "Draft saved");
    if (launched && edits.current === sent) onClose();
  };

  const sendTest = async () => {
    if (!check()) return;
    // Saving a launched campaign publishes it: a test must never do that on its own.
    if (launched && dirty)
      return setError(
        "Save your changes first. A test shows the message as it was last saved."
      );
    const campaign = dirty || !saved ? await persist() : saved;
    if (!campaign) return;
    try {
      const devices = await test.mutateAsync({
        id: campaign.id,
        identifier: tester.trim(),
      });
      showSuccessNotification(
        devices === 1
          ? "Sent to 1 device. Open the app to see it."
          : `Sent to ${devices} devices. Open the app to see it.`
      );
    } catch (e) {
      setError(inAppErrorText(e, "Could not send the test."));
    }
  };

  const launch = async () => {
    const campaign = await persist();
    if (!campaign) return;
    try {
      const live = await step.mutateAsync({ id: campaign.id, step: "launch" });
      showSuccessNotification(
        live.status === "preparing"
          ? "Launched. It goes live once its audience is ready."
          : live.status === "scheduled"
            ? "Launched. It starts at its start time."
            : "The campaign is live"
      );
      onClose();
    } catch (e) {
      const message = inAppErrorText(e, "Could not launch the campaign.");
      setError(message);
      showErrorNotification(message);
    }
  };

  const index = IN_APP_SECTIONS.indexOf(section);
  const shownDraft = {
    ...withVariant(draft, variant),
    image: {
      portrait: local.portrait ?? draft.image.portrait,
      landscape: local.landscape ?? draft.image.landscape,
    },
  };
  // The message step shows this one by the question itself.
  const inline = questionTemplateProblem(draft);
  const alertInline =
    draft.template === "alert"
      ? alertLimitProblems(withVariant(draft, variant)).map((p) =>
          variant === "a" ? p : `Variant ${variant.toUpperCase()}: ${p}`
        )
      : [];
  const visible = shown
    ? problems[section].filter((p) => p !== inline && !alertInline.includes(p))
    : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <ComposerNav
        label="Campaign sections"
        sections={IN_APP_SECTIONS}
        labels={SECTION_LABELS}
        current={section}
        onSelect={setSection}
        stateOf={(item, i) => {
          const done = shown || i < index ? problems[item].length === 0 : false;
          if (shown && problems[item].length > 0) return "wrong";
          return done && item !== "review" ? "done" : "todo";
        }}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <div className="min-w-0 flex-1 space-y-5 overflow-y-auto p-5">
            <div>
              <h3 className="text-[15px] font-semibold">
                {SECTION_LABELS[section]}
              </h3>
              <p className="text-[13px] text-muted-foreground">
                {SECTION_META[section]}
              </p>
            </div>
            {visible.map((problem) => (
              <FieldError key={problem} message={problem} />
            ))}
            {section === "message" && (
              <MessageSection
                draft={withVariant(draft, variant)}
                images={shownDraft.image}
                set={setContent}
                setHtml={setHtml}
                variant={variant}
                onEditA={() => setVariant("a")}
                variantBar={
                  <VariantBar
                    variants={[
                      { id: "a", title: draft.title },
                      ...draft.variants.map((v) => ({
                        id: v.id,
                        title: v.content.title,
                      })),
                    ]}
                    selected={variant}
                    onSelect={setVariant}
                    onAdd={launched ? undefined : onAddVariant}
                    onRemove={launched ? undefined : onRemoveVariant}
                    // An upload in flight would land on the removed variant.
                    removeDisabled={mediaJobs > 0}
                  >
                    <SplitOverview
                      controlGroup={draft.controlGroup}
                      variants={draft.variants.length}
                      projectControlGroup={projectControlGroup}
                    />
                  </VariantBar>
                }
                launched={launched}
                uploading={uploading}
                onImage={(slot, file) => void onImage(slot, file)}
                suggestions={suggestions}
                media={
                  <CampaignMedia
                    projectId={projectId}
                    campaignId={saved?.id ?? null}
                    htmls={[
                      draft.html,
                      ...draft.variants.map((v) => v.content.html),
                    ]}
                    upload={upload}
                    remove={remove}
                  />
                }
                uploadMedia={upload}
                onDesignChange={setDesigning}
              />
            )}
            {section === "trigger" && (
              <TriggerSection
                projectId={projectId}
                draft={draft}
                set={set}
                suggestions={suggestions}
              />
            )}
            {section === "audience" && (
              <AudienceSection
                projectId={projectId}
                draft={draft}
                set={set}
                launched={launched}
                suggestions={suggestions}
              />
            )}
            {section === "experiment" && (
              <ExperimentSection
                projectId={projectId}
                draft={draft}
                set={set}
                launched={launched}
                projectControlGroup={projectControlGroup}
              />
            )}
            {section === "limits" && <LimitsSection draft={draft} set={set} />}
            {section === "review" && (
              <div className="space-y-4">
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3.5",
                    hasProblems(problems)
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-valid-green/30 bg-valid-green/5"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white",
                      hasProblems(problems)
                        ? "bg-destructive"
                        : "bg-valid-green"
                    )}
                  >
                    {hasProblems(problems) ? (
                      <span className="text-[11px] font-bold">!</span>
                    ) : (
                      <Check className="size-3" />
                    )}
                  </span>
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-[13px] font-semibold">
                      {hasProblems(problems)
                        ? "Not ready to launch yet"
                        : launched
                          ? "This campaign is running"
                          : "Ready to launch"}
                    </p>
                    {hasProblems(problems) ? (
                      IN_APP_SECTIONS.filter((s) => problems[s].length > 0).map(
                        (s) => (
                          <div key={s} className="space-y-1">
                            <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                              {SECTION_LABELS[s]}
                            </p>
                            {problems[s].map((p) => (
                              <div
                                key={p}
                                className="flex items-center gap-3 rounded-md bg-background/60 px-2.5 py-1.5"
                              >
                                <div className="min-w-0 flex-1">
                                  <FieldError message={p} />
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-7 shrink-0 gap-1 px-2.5 text-xs"
                                  aria-label={`Fix: ${p}`}
                                  onClick={() => {
                                    setSection(s);
                                    if (s === "message")
                                      setVariant(variantOf(p) ?? "a");
                                  }}
                                >
                                  Fix it
                                  <ArrowRight className="size-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )
                      )
                    ) : (
                      <p className="text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
                        {launchSentence(
                          draft.template,
                          draft.triggers,
                          draft.audience.type === "segment"
                            ? `people in ${segmentName ?? "the segment"}`
                            : "everyone",
                          draft.startAt !== ""
                        )}
                      </p>
                    )}
                  </div>
                </div>
                {warnings.map((warning) => (
                  <p
                    key={warning}
                    className="text-xs text-amber-600 dark:text-amber-400"
                  >
                    {warning}
                  </p>
                ))}
                <InAppSummary
                  draft={draft}
                  segmentName={segmentName}
                  projectControlGroup={projectControlGroup}
                  onEdit={setSection}
                />
                <div className="space-y-1.5 rounded-lg border border-sidebar-border bg-background p-3.5">
                  <label
                    htmlFor="in-app-name"
                    className="text-[13px] font-medium"
                  >
                    Name in your list (optional)
                  </label>
                  <Input
                    id="in-app-name"
                    maxLength={255}
                    placeholder={draftName({ ...draft, name: "" })}
                    value={draft.name}
                    onChange={(e) => set({ name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Only your team sees it. Without one, the title is used.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="in-app-tester"
                    className="text-[13px] font-medium"
                  >
                    See it on a device
                  </label>
                  <div className="flex gap-2">
                    <Input
                      id="in-app-tester"
                      placeholder="User identifier"
                      value={tester}
                      onChange={(e) => {
                        setTester(e.target.value);
                        setError(null);
                      }}
                    />
                    <Button
                      variant="outline"
                      disabled={busy || !tester.trim()}
                      onClick={() => void sendTest()}
                    >
                      {test.isPending && (
                        <Loader2 className="size-4 animate-spin" />
                      )}
                      Send test
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The identifier your app gives the SDK for that person. The
                    message shows the next time their app is opened, within 10
                    minutes, and is not counted.
                  </p>
                </div>
              </div>
            )}
          </div>
          <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-sidebar-border bg-sidebar p-5 lg:block">
            {!designing && <PreviewPanel draft={shownDraft} />}
          </aside>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-sidebar-border px-5 py-3">
          <div className="min-w-0 flex-1 space-y-1">
            <FieldError message={error ?? undefined} />
          </div>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => void saveDraft()}
          >
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {launched ? "Save changes" : "Save draft"}
          </Button>
          {section !== "review" ? (
            <Button
              onClick={() => setSection(IN_APP_SECTIONS[index + 1] ?? section)}
            >
              Next
            </Button>
          ) : (
            !launched && (
              <Button
                disabled={busy}
                onClick={() => check() && setConfirmLaunch(true)}
              >
                Launch
              </Button>
            )
          )}
        </div>
      </div>

      <ActionConfirm
        open={confirmLaunch}
        setOpen={setConfirmLaunch}
        title="Launch this campaign?"
        description={
          draft.audience.type === "segment"
            ? "Its audience is calculated first, then devices start receiving it. You can pause or end it at any time."
            : "Devices start receiving it at their next sync. You can pause or end it at any time."
        }
        confirmText="Launch"
        pendingText="Launching..."
        cancelText="Not yet"
        onConfirm={launch}
      />
      <ActionConfirm
        open={confirmDiscard}
        setOpen={setConfirmDiscard}
        title="Close without saving?"
        description="The changes you made since the last save will be lost."
        confirmText="Discard changes"
        cancelText="Keep editing"
        onConfirm={onClose}
      />
    </div>
  );
}
