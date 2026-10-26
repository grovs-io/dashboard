"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useWatch } from "react-hook-form";
import { Loader2 } from "lucide-react";
import ActionConfirm from "@/components/common/action-confirm";
import { FieldError } from "@/components/common/FieldError";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useGlobalLinkDialog } from "@/context/useLinkDialogContext";
import { useProjectSelection } from "@/context/useProjectSelection";
import { ApiError } from "@/lib/ApiError";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { cn } from "@/lib/utils";
import { pushContentSchema, type PushContentFormValues } from "@/schemas/push";
import { recipientsLabel, segmentLabel } from "@ee/lib/audience";
import { hadUploadedImage, pushErrorText } from "@ee/lib/push";
import {
  SECTION_LABELS,
  addPushVariant,
  audienceFromCampaign,
  audienceValid,
  campaignInput,
  contentFromCampaign,
  defaultSchedule,
  emptyAudience,
  emptyContent,
  emptyExperiment,
  experimentFromCampaign,
  experimentProblems,
  experimentSummary,
  pushErrorSection,
  removePushVariant,
  scheduleError,
  scheduleInput,
  type ExperimentValue,
  type PushSection,
  type ScheduleValue,
} from "@ee/lib/pushComposer";
import {
  useRemovePushImage,
  useSendPushCampaign,
} from "@ee/hooks/mutations/usePushMutations";
import { useSegmentsQuery } from "@ee/hooks/queries/useSegmentsQueries";
import {
  pushCampaignQueryOptions,
  usePushChannels,
} from "@ee/hooks/queries/usePushQueries";
import PushSetupNotice from "@ee/components/push/PushSetupNotice";
import SplitOverview from "@ee/components/experiments/SplitOverview";
import VariantBar from "@ee/components/experiments/VariantBar";
import { useInAppSettingsQuery } from "@ee/hooks/queries/useInAppQueries";
import { reachCount } from "@ee/lib/push";
import type { VariantKey } from "@ee/lib/inAppComposer";
import { VARIANT_IDS, type VariantId } from "@ee/types/experiment";
import AudiencePicker from "@ee/components/audience/AudiencePicker";
import ReachPanel from "@ee/components/push/ReachPanel";
import type { AudienceValue } from "@ee/types/audience";
import type { PushCampaign, PushEstimate } from "@ee/types/push";
import DeliverySection from "./DeliverySection";
import ExperimentSection from "./ExperimentSection";
import MessageSection, { usePushContentForm } from "./MessageSection";
import NotificationPreview from "./NotificationPreview";
import SectionNav from "./SectionNav";
import SendConfirmDialog from "./SendConfirmDialog";
import { usePushDraft } from "./usePushDraft";

export type CloseRef = MutableRefObject<(() => void) | null>;

interface Props {
  projectId: string;
  initial?: PushCampaign;
  closeRef: CloseRef;
  onClose: () => void;
}

interface SectionError {
  section: PushSection;
  message: string;
}

const SECTION_META: Record<PushSection, string> = {
  message: "What people see on their lock screen, and where a tap takes them.",
  audience:
    "Who receives this push. Reach refreshes after each change is saved.",
  experiment:
    "Measure what the push does: a goal to count, a control group to compare with, and, if you add variants in the Message step, which version wins.",
  delivery: "Send it as soon as you confirm, or pick a time.",
};

function useObjectUrl(file: File | null) {
  const url = useMemo(
    () =>
      file && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(file)
        : null,
    [file]
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url]
  );
  return url;
}

const WIDE_QUERY = "(min-width: 768px)";

// The preview sits in the rail on wide screens and under the message fields otherwise.
function useWide() {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const mql = window.matchMedia(WIDE_QUERY);
      mql.addEventListener("change", notify);
      return () => mql.removeEventListener("change", notify);
    },
    () =>
      typeof window.matchMedia !== "function" ||
      window.matchMedia(WIDE_QUERY).matches,
    () => true
  );
}

type SaveTrigger = "auto" | "section" | "user";

const audienceMissing = (a: AudienceValue) =>
  a.type === "segment"
    ? "Pick the segment to send to."
    : "Add at least one recipient: a user id or a device.";

export default function PushComposer({
  projectId,
  initial: initialProp,
  closeRef,
  onClose,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { selectedProject } = useProjectSelection();
  const { openLinkDialog } = useGlobalLinkDialog();
  const [initial] = useState(initialProp);
  const [initialContent] = useState(() =>
    initial ? contentFromCampaign(initial) : emptyContent()
  );
  const [audience, setAudience] = useState<AudienceValue>(() =>
    initial ? audienceFromCampaign(initial) : emptyAudience()
  );
  const [experiment, setExperiment] = useState<ExperimentValue>(() =>
    initial ? experimentFromCampaign(initial) : emptyExperiment()
  );
  const [showExperimentErrors, setShowExperimentErrors] = useState(false);
  // The project-wide control group lives in the in-app settings and comes off the top of every split.
  const projectControlGroup =
    useInAppSettingsQuery(projectId).data?.control_group ?? 0;
  // Which variant the message step edits and the preview shows; not saved.
  const [chosen, setChosen] = useState<VariantKey>("a");
  const form = usePushContentForm(initialContent);
  const draft = usePushDraft(
    projectId,
    initial ?? null,
    campaignInput(
      initialContent,
      initial ? audienceFromCampaign(initial) : emptyAudience(),
      initial,
      initial ? experimentFromCampaign(initial) : emptyExperiment()
    )
  );
  const removeImage = useRemovePushImage(projectId);
  const send = useSendPushCampaign(projectId);
  const segments = useSegmentsQuery(projectId, false);
  const [section, setSection] = useState<PushSection>("message");
  const [deliveryVisited, setDeliveryVisited] = useState(false);
  if (section === "delivery" && !deliveryVisited) setDeliveryVisited(true);
  const [initialSchedule] = useState<ScheduleValue>(defaultSchedule);
  const [schedule, setSchedule] = useState<ScheduleValue>(initialSchedule);
  // The switch keeps its state under Send now, where it does not apply.
  const localTime = schedule.mode === "schedule" && schedule.localTime;
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [sectionError, setSectionError] = useState<SectionError | null>(null);
  const [audienceError, setAudienceError] = useState<string | null>(null);
  const [showScheduleErrors, setShowScheduleErrors] = useState(false);
  const [reach, setReach] = useState<PushEstimate | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{
    section: PushSection;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failed = useRef<{ input: string; file: File | null } | null>(null);

  const content = useWatch({ control: form.control }) as PushContentFormValues;
  const values = { ...emptyContent(), ...content };
  const active = experiment.variants.find((v) => v.id === chosen);
  // A removed variant falls back to A.
  const variant: VariantKey = active ? chosen : "a";
  const shown = active ?? { title: values.title, body: values.body };
  const editVariant = (patch: { title?: string; body?: string }) =>
    setExperiment((e) => ({
      ...e,
      variants: e.variants.map((v) =>
        v.id === variant ? { ...v, ...patch } : v
      ),
    }));
  const onAddVariant = () => {
    setChosen(VARIANT_IDS[experiment.variants.length] ?? "a");
    setExperiment((e) => addPushVariant(e, shown));
  };
  const onRemoveVariant = (id: VariantId) => {
    setChosen("a");
    setExperiment((e) => removePushVariant(e, id));
  };
  const campaign = draft.campaign;
  const input = campaignInput(values, audience, campaign, experiment);
  const dirty = draft.isDirty(input, imageFile);
  // The schedule is never stored on the draft, so only the close guard counts it.
  const unsaved =
    dirty || JSON.stringify(schedule) !== JSON.stringify(initialSchedule);
  const previewImage = useObjectUrl(imageFile);
  const uploadedImage =
    campaign && hadUploadedImage(campaign) ? campaign.image : null;
  const wide = useWide();
  const contentValid = pushContentSchema.safeParse(values).success;

  useEffect(() => {
    closeRef.current = () => (unsaved ? setConfirmDiscard(true) : onClose());
    return () => {
      closeRef.current = null;
    };
  }, [closeRef, unsaved, onClose]);

  useEffect(() => {
    if (!unsaved) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [unsaved]);

  // Hidden sections and the collapsed Advanced panel defeat RHF's own error focus, so do it here.
  useEffect(() => {
    if (!focusRequest) return;
    const frame = requestAnimationFrame(() => {
      const root = scrollRef.current?.querySelector<HTMLElement>(
        `[data-section="${focusRequest.section}"]`
      );
      const invalid = root?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (invalid) {
        invalid.scrollIntoView({ behavior: "smooth", block: "center" });
        invalid.focus({ preventScroll: true });
      } else scrollRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
      setFocusRequest(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  const showSection = useCallback((target: PushSection) => {
    setSection(target);
    setFocusRequest({ section: target });
  }, []);

  const leaveTo = useCallback(
    (path: string) => {
      setLeaving(true);
      onClose();
      router.push(path);
    },
    [onClose, router]
  );

  const reloadAfterConflict = useCallback(
    async (message: string) => {
      showErrorNotification(message);
      if (!campaign) return;
      try {
        const fresh = await queryClient.fetchQuery(
          pushCampaignQueryOptions(projectId, campaign.id)
        );
        if (fresh.status !== "draft") leaveTo(`/push/${campaign.id}`);
        else draft.replaceCampaign(fresh);
      } catch {
        // The notification above already tells the user to reload.
      }
    },
    [campaign, draft, leaveTo, projectId, queryClient]
  );

  const clearAutosave = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = null;
  }, []);

  // A 409 reloads the campaign; anything else is shown on the section it names.
  const showSaveError = useCallback(
    async (e: unknown, fallback: string, conflict: string, focus: boolean) => {
      if (e instanceof ApiError && e.status === 409) {
        await reloadAfterConflict(e.message || conflict);
        return;
      }
      const message = pushErrorText(e, fallback);
      const target =
        (e instanceof ApiError && e.status === 422
          ? pushErrorSection(message)
          : null) ?? section;
      setSectionError({ section: target, message });
      if (focus) showSection(target);
    },
    [reloadAfterConflict, section, showSection]
  );

  const persist = useCallback(
    async (trigger: SaveTrigger = "user"): Promise<boolean> => {
      if (trigger !== "auto") clearAutosave();
      const next = campaignInput(
        form.getValues(),
        audience,
        campaign,
        experiment
      );
      if (!draft.isDirty(next, imageFile)) return true;
      const attempt = JSON.stringify(next);
      // A failed save is re-sent only by Save draft or the primary button.
      if (
        trigger !== "user" &&
        failed.current?.input === attempt &&
        failed.current.file === imageFile
      )
        return false;
      if (!audienceValid(audience)) {
        if (!campaign) return true;
        setAudienceError(audienceMissing(audience));
        return false;
      }
      const file = imageFile;
      try {
        await draft.save(next, file);
        failed.current = null;
        if (file)
          setImageFile((current) => (current === file ? null : current));
        setSectionError(null);
        return true;
      } catch (e) {
        failed.current = { input: attempt, file };
        await showSaveError(
          e,
          "Could not save the draft.",
          "This campaign is no longer a draft.",
          trigger === "user"
        );
        return false;
      }
    },
    [
      audience,
      campaign,
      clearAutosave,
      draft,
      experiment,
      form,
      imageFile,
      showSaveError,
    ]
  );
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  });

  const canAutosave = useCallback(
    () =>
      audienceValid(audience) &&
      pushContentSchema.safeParse(form.getValues()).success,
    [audience, form]
  );

  // Only audience edits autosave, never the opening itself; the timer reads the latest persist when it fires.
  const openedAudience = useRef(audience);
  useEffect(() => {
    if (audience === openedAudience.current || !canAutosave()) return;
    autosaveTimer.current = setTimeout(() => {
      autosaveTimer.current = null;
      void persistRef.current("auto");
    }, 500);
    return clearAutosave;
  }, [audience, canAutosave, clearAutosave]);

  const selectSection = (target: PushSection) => {
    if (target === section) return;
    setSection(target);
    if (canAutosave()) void persist("section");
    else clearAutosave();
  };

  const validateAll = async (): Promise<boolean> => {
    clearAutosave();
    if (!(await form.trigger())) {
      showSection("message");
      return false;
    }
    if (!audienceValid(audience)) {
      setAudienceError(audienceMissing(audience));
      showSection("audience");
      return false;
    }
    if (experimentProblems(experiment, { localTime }).length > 0) {
      setShowExperimentErrors(true);
      // Variants are written in the message step; the first one with a gap is shown.
      const gap = experiment.variants.find(
        (v) => !v.title.trim() || !v.body.trim()
      );
      if (gap) setChosen(gap.id);
      showSection(gap ? "message" : "experiment");
      return false;
    }
    return true;
  };

  const saveDraft = async () => {
    if (!(await validateAll())) return;
    if (!(await persist())) return;
    showSuccessNotification("Draft saved");
    onClose();
  };

  const requestSend = async () => {
    if (sendBlocked) return;
    if (!(await validateAll())) return;
    if (scheduleError(schedule)) {
      setShowScheduleErrors(true);
      showSection("delivery");
      return;
    }
    if (await persist()) setConfirming(true);
  };

  const submit = async () => {
    if (!campaign) return;
    // Setup can resolve to "none" while the confirmation is open.
    if (sendBlocked) {
      setConfirming(false);
      return;
    }
    const invalid = scheduleError(schedule);
    if (invalid) {
      setConfirming(false);
      setShowScheduleErrors(true);
      showSection("delivery");
      return;
    }
    try {
      const sent = await send.mutateAsync({
        id: campaign.id,
        schedule: scheduleInput(schedule),
      });
      setConfirming(false);
      showSuccessNotification(
        sent.status === "scheduled"
          ? "Campaign scheduled"
          : "Campaign is sending"
      );
      leaveTo(`/push/${sent.id}`);
    } catch (e) {
      setConfirming(false);
      await showSaveError(
        e,
        "Could not send the campaign.",
        "This campaign has already been sent.",
        true
      );
    }
  };

  const createLink = () =>
    openLinkDialog({
      onSuccess: (link) => {
        if (link)
          form.setValue("linkId", Number(link.id), {
            shouldDirty: true,
            shouldValidate: true,
          });
      },
    });

  const done: Record<PushSection, boolean> = {
    message: contentValid,
    audience: audienceValid(audience),
    experiment: experimentProblems(experiment, { localTime }).length === 0,
    delivery: deliveryVisited && !scheduleError(schedule),
  };

  const audienceLabel =
    audience.type === "segment"
      ? segmentLabel(
          segments.data?.segments?.find((s) => s.id === audience.segmentId)
            ?.name
        )
      : recipientsLabel(audience.type, audience.recipients.length);

  const busy =
    draft.saving || leaving || send.isPending || removeImage.isPending;
  const audienceOk = audienceValid(audience);
  const channels = usePushChannels();
  const scheduled = schedule.mode === "schedule";
  // Setup can finish before a scheduled time, and the current audience's reachable estimate outranks the config check.
  const sendBlocked =
    !scheduled &&
    !!channels &&
    !channels.ios &&
    !channels.android &&
    !((reach?.reachable ?? 0) > 0);

  const preview = (
    <NotificationPreview
      appName={selectedProject?.name ?? "Your app"}
      title={shown.title}
      body={shown.body}
      image={values.imageUrl.trim() || previewImage || uploadedImage}
    />
  );
  const variantBar = (
    <VariantBar
      variants={[
        { id: "a", title: values.title },
        ...experiment.variants.map((v) => ({ id: v.id, title: v.title })),
      ]}
      selected={variant}
      onSelect={setChosen}
      onAdd={onAddVariant}
      onRemove={onRemoveVariant}
    >
      <SplitOverview
        controlGroup={experiment.controlGroup}
        variants={experiment.variants.length}
        projectControlGroup={projectControlGroup}
        audience={reach ? reachCount(reach) : null}
      />
    </VariantBar>
  );

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:w-[300px] md:overflow-auto md:border-b-0 md:border-r lg:w-[320px]">
          {wide && (
            <div className="border-b border-sidebar-border p-4">{preview}</div>
          )}
          <div className="p-2 md:p-3">
            <SectionNav
              section={section}
              done={done}
              onSelect={selectSection}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-sidebar-border px-4 py-4 sm:px-6">
            <h3 className="text-[15px] font-semibold">
              {SECTION_LABELS[section]}
            </h3>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {SECTION_META[section]}
            </p>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
            <div className="flex max-w-[680px] flex-col gap-6 px-4 py-6 sm:px-6">
              {sectionError && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px]"
                >
                  <span>{sectionError.message}</span>
                  {sectionError.section !== section && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => setSection(sectionError.section)}
                    >
                      Go to {SECTION_LABELS[sectionError.section]}
                    </Button>
                  )}
                </div>
              )}

              <div hidden={section !== "message"} data-section="message">
                <MessageSection
                  projectId={projectId}
                  form={form}
                  imageFile={imageFile}
                  onImageFileChange={setImageFile}
                  uploadedImage={imageFile ? null : uploadedImage}
                  removingImage={removeImage.isPending}
                  onCreateLink={createLink}
                  variantBar={variantBar}
                  variant={
                    active
                      ? {
                          title: active.title,
                          body: active.body,
                          onChange: editVariant,
                          showErrors: showExperimentErrors,
                        }
                      : undefined
                  }
                  onRemoveUploadedImage={async () => {
                    if (!campaign) return;
                    try {
                      draft.replaceCampaign(
                        await removeImage.mutateAsync(campaign.id)
                      );
                    } catch (e) {
                      showErrorNotification(
                        pushErrorText(e, "Could not remove the image.")
                      );
                    }
                  }}
                />
                {!wide && (
                  <div className="mt-8 border-t border-sidebar-border pt-6">
                    {preview}
                  </div>
                )}
              </div>

              {/* The picker seeds once from `audience`, so it stays mounted while other sections show. */}
              <div hidden={section !== "audience"} data-section="audience">
                <div className="flex flex-col gap-5">
                  <PushSetupNotice channels={channels} newTab hideConsequence />
                  <AudiencePicker
                    projectId={projectId}
                    value={audience}
                    onChange={(value) => {
                      setAudience(value);
                      setAudienceError(null);
                    }}
                  />
                  <FieldError message={audienceError ?? undefined} />
                  <ReachPanel
                    projectId={projectId}
                    audience={audience}
                    onEstimate={setReach}
                  />
                </div>
              </div>

              <div hidden={section !== "experiment"} data-section="experiment">
                <ExperimentSection
                  projectId={projectId}
                  value={experiment}
                  onChange={setExperiment}
                  projectControlGroup={projectControlGroup}
                  audience={reach ? reachCount(reach) : null}
                  localTime={localTime}
                />
              </div>

              <div hidden={section !== "delivery"} data-section="delivery">
                <DeliverySection
                  value={schedule}
                  onChange={setSchedule}
                  showErrors={showScheduleErrors}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Separator />
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-3">
        <p
          id="push-draft-status"
          className={cn(
            "flex w-full min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground sm:w-auto sm:flex-1",
            !draft.saving &&
              !campaign &&
              audienceOk &&
              "invisible max-sm:hidden"
          )}
          aria-live="polite"
        >
          {draft.saving ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </>
          ) : !audienceOk ? (
            "Pick an audience to save a draft"
          ) : campaign ? (
            dirty ? (
              "Unsaved changes"
            ) : (
              "Draft saved"
            )
          ) : null}
        </p>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          {sendBlocked && (
            <span
              id="push-send-blocked"
              className="w-full text-right text-xs text-muted-foreground sm:w-auto"
            >
              Set up iOS or Android push to send now
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={busy || !audienceOk}
            aria-describedby={audienceOk ? undefined : "push-draft-status"}
            onClick={() => void saveDraft()}
          >
            Save draft
          </Button>
          <Button
            type="button"
            disabled={busy || sendBlocked}
            aria-describedby={sendBlocked ? "push-send-blocked" : undefined}
            onClick={() => void requestSend()}
          >
            {scheduled ? "Schedule…" : "Send now"}
          </Button>
        </div>
      </div>

      <SendConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={values.title.trim()}
        audience={audienceLabel}
        reach={reach}
        schedule={schedule}
        experiment={experimentSummary(experiment)}
        pending={send.isPending}
        onConfirm={() => void submit()}
      />
      <ActionConfirm
        open={confirmDiscard}
        setOpen={setConfirmDiscard}
        onConfirm={() => {
          clearAutosave();
          onClose();
        }}
        title="Discard unsaved changes?"
        description="Your latest edits have not been saved. A draft saved earlier stays in the list."
        confirmText="Discard"
        cancelText="Continue editing"
      />
    </>
  );
}
