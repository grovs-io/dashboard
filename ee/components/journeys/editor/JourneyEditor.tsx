"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MutableRefObject,
} from "react";
import { useRouter } from "next/navigation";
import {
  Flag,
  LayoutList,
  Loader2,
  Lock,
  Pencil,
  Route,
  X,
  Zap,
} from "lucide-react";
import ActionConfirm from "@/components/common/action-confirm";
import { FieldError } from "@/components/common/FieldError";
import { ApiError } from "@/lib/ApiError";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import { useInAppSettingsQuery } from "@ee/hooks/queries/useInAppQueries";
import { useSegmentsQuery } from "@ee/hooks/queries/useSegmentsQueries";
import {
  useJourneyImage,
  useJourneyStep,
  useSaveJourney,
} from "@ee/hooks/mutations/useJourneyMutations";
import {
  continueAt,
  deleteStep,
  highestStepId,
  insertStep,
  isLocked,
  lostSteps,
  journeyErrorText,
  journeyInput,
  journeyName,
  problems as findProblems,
  sameJourney,
  stepsInput,
  updateStep,
  waitsOn,
  stepLabel,
  type Anchor,
  type JourneyFocus,
} from "@ee/lib/journeys";
import type {
  BranchKey,
  Journey,
  JourneyInput,
  JourneyStep,
  StepType,
} from "@ee/types/journey";
import JourneyMap, { GOALS, SETTINGS } from "../JourneyMap";
import JourneyStatusPill from "../JourneyStatusPill";
import MapViewport from "../MapViewport";
import StepPanel, { PanelHeader, type UploadImage } from "../StepPanel";
import {
  ControlGroupSection,
  EntrySection,
  GoalsSection,
  LockedNote,
  ScheduleSection,
} from "../sections";
import Checklist, { checklist, type CheckItem } from "./Checklist";
import ReviewDialog from "./ReviewDialog";

export const inputOf = (j: Journey): JourneyInput => ({
  name: j.name,
  entry: j.entry,
  re_entry: j.re_entry,
  goals: j.goals,
  control_group: j.control_group,
  start_at: j.start_at,
  end_at: j.end_at,
  first_step: j.first_step,
  steps: j.steps,
});

const FOCUS: Record<JourneyFocus, string | null> = {
  entry: SETTINGS,
  goals: GOALS,
  overview: null,
};

// Click to rename; Enter or leaving the field keeps it, Escape puts it back.
function NameField({
  name,
  disabled,
  onChange,
}: {
  name: string;
  disabled: boolean;
  onChange: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(name);
  if (editing)
    return (
      <Input
        autoFocus
        aria-label="Journey name"
        maxLength={255}
        className="h-8 w-64 text-[15px] font-semibold"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          onChange(text);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            e.stopPropagation();
            setText(name);
            setEditing(false);
          }
        }}
      />
    );
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Rename ${journeyName({ name })}`}
      onClick={() => {
        setText(name);
        setEditing(true);
      }}
      className="group flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-[15px] font-semibold hover:bg-muted"
    >
      <span className="truncate">{journeyName({ name })}</span>
      <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

const WAITING = "Waiting for the image to upload";

const typing = (el: EventTarget | null) =>
  el instanceof HTMLElement &&
  !!el.closest("input, textarea, [contenteditable=true]");

export default function JourneyEditor({
  projectId,
  initial,
  fresh,
  focus,
  closeRef,
  escapeRef,
  onClose,
}: {
  projectId: string;
  initial: Journey;
  // Just made from a template: the dialog says "Create journey".
  fresh?: boolean;
  focus?: JourneyFocus;
  // The dialog asks this before closing, so unsaved changes are confirmed.
  closeRef: MutableRefObject<(() => void) | null>;
  // Escape first deselects a card; true when it did.
  escapeRef: MutableRefObject<(() => boolean) | null>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<JourneyInput>(() => inputOf(initial));
  const draftNow = useRef(draft);
  useEffect(() => {
    draftNow.current = draft;
  });
  const [saved, setSaved] = useState<Journey>(initial);
  const [selected, select] = useState<string | null>(
    focus ? FOCUS[focus] : null
  );
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const edits = useRef(0);

  const save = useSaveJourney(projectId);
  const step = useJourneyStep(projectId);
  const segments = useSegmentsQuery(projectId, false);
  const projectControlGroup =
    useInAppSettingsQuery(projectId).data?.control_group ?? 0;
  const segmentName = (id: string) =>
    segments.data?.segments.find((s) => s.id === id)?.name ?? null;

  const locked = isLocked(saved);
  const busy = save.isPending || step.isPending;
  // Ids only go up, so a late upload for a removed step never finds a new one under its id.
  const lastId = useRef(highestStepId(Object.keys(initial.steps)));
  const image = useJourneyImage(projectId, initial.id);
  const [uploads, setUploads] = useState(0);
  const uploading = uploads > 0;
  const lockVersion = useRef(initial.lock_version);
  useEffect(() => {
    lockVersion.current = saved.lock_version;
  }, [saved.lock_version]);
  // Save and upload answers can arrive in any order: the higher lock_version wins.
  const keepLock = (lock: number) =>
    setSaved((s) => (lock > s.lock_version ? { ...s, lock_version: lock } : s));
  const found = useMemo(
    () => findProblems(draft, { launched: locked }),
    [draft, locked]
  );
  // After launch only step content can change, so only its problems block a save.
  const items = useMemo(() => {
    const all = checklist(draft, found);
    return locked
      ? all.filter((i) => i.target !== null && !!draft.steps[i.target])
      : all;
  }, [draft, found, locked]);
  const dirty = !sameJourney(draft, inputOf(saved));
  const current =
    selected && draft.steps[selected] ? draft.steps[selected] : null;
  const panel =
    selected === SETTINGS || selected === GOALS || current ? selected : null;

  // One undo: the draft as it was before the last removal, offered for a few seconds.
  const [undo, setUndo] = useState<{
    before: JourneyInput;
    id: string;
    text: string;
  } | null>(null);
  // Any edit ends the undo offer, so undoing can never wipe a later edit.
  const apply = useCallback((fn: (d: JourneyInput) => JourneyInput) => {
    setDraft(fn);
    setUndo(null);
    edits.current += 1;
    setError(null);
  }, []);
  const set = (patch: Partial<JourneyInput>) =>
    apply((d) => ({ ...d, ...patch }));

  // Scrolls the canvas alone: scrollIntoView would also move the app shell around it.
  const reveal = (id: string) =>
    requestAnimationFrame(() => {
      const box = document.querySelector<HTMLElement>("[data-journey-map]");
      const card = box?.querySelector<HTMLElement>(`[data-step-id="${id}"]`);
      if (!box || !card) return;
      const a = box.getBoundingClientRect();
      const b = card.getBoundingClientRect();
      box.scrollTo?.({
        left: box.scrollLeft + b.left - a.left - (a.width - b.width) / 2,
        top: box.scrollTop + b.top - a.top - (a.height - b.height) / 2,
        behavior: "smooth",
      });
    });
  const go = (item: CheckItem) => {
    setReviewing(false);
    select(item.target);
    if (item.target) reveal(item.target);
  };

  const insert = (anchor: Anchor, type: StepType) => {
    const made = insertStep(draft, anchor, type, lastId.current);
    lastId.current = highestStepId([made.id]);
    apply(() => made.draft);
    select(made.id);
    reveal(made.id);
  };
  const join = (anchor: Anchor, target: string) => {
    const next = continueAt(draft, anchor, target);
    if (next) apply(() => next);
    else setError("That would loop back. Choose a step further down.");
  };

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(t);
  }, [undo]);
  const remove = (id: string, keep?: BranchKey, confirmed = false) => {
    const after = deleteStep(draft, id, keep);
    // Waits on this step lose their Time ran out path; say what goes first.
    const lost = lostSteps(draft, after) - 1;
    if (!confirmed && !keep && lost > 0 && waitsOn(draft, id).length)
      return setRemoving({ id, lost });
    apply(() => after);
    setUndo({ before: draft, id, text: "Step removed" });
    select(null);
  };
  const [removing, setRemoving] = useState<{ id: string; lost: number } | null>(
    null
  );
  // Edits that drop steps (a split path, a Time ran out path) can be undone too.
  const onStep = (next: JourneyStep) => {
    const after = updateStep(draft, next);
    apply((d) => updateStep(d, next));
    if (lostSteps(draft, after) > 0)
      setUndo({ before: draft, id: next.id, text: "Steps removed" });
  };
  // An upload lands on the step as it is now, changing only its image, if that step is still there.
  const uploadImage: UploadImage = async (from, file, patch) => {
    setUploads((n) => n + 1);
    try {
      const { url, lock_version } = await image.mutateAsync({
        file,
        lockVersion: lockVersion.current,
      });
      // A patch that changes nothing (a media file) leaves the undo offer and edits alone.
      const now = draftNow.current.steps[from.id];
      if (now?.type === from.type && patch(now, url) !== now)
        apply((d) => {
          const step = d.steps[from.id];
          return step?.type === from.type
            ? { ...d, steps: { ...d.steps, [from.id]: patch(step, url) } }
            : d;
        });
      if (lock_version !== undefined) keepLock(lock_version);
      return url;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409)
        setError(journeyErrorText(e, "Could not save the journey."));
      throw e;
    } finally {
      setUploads((n) => n - 1);
    }
  };
  const restore = () => {
    if (!undo) return;
    apply(() => undo.before);
    select(undo.id);
    setUndo(null);
  };

  const persist = async (): Promise<Journey | null> => {
    const sent = edits.current;
    // After launch the server takes only content changes, so nothing else is sent.
    const input = locked
      ? {
          name: journeyName(draft),
          steps: stepsInput(draft.steps),
          lock_version: saved.lock_version,
        }
      : { ...journeyInput(draft), lock_version: saved.lock_version };
    try {
      const journey = await save.mutateAsync({ id: saved.id, input });
      setSaved((s) =>
        s.lock_version > journey.lock_version
          ? { ...journey, lock_version: s.lock_version }
          : journey
      );
      // What was typed while the save was on its way stays unsaved.
      if (edits.current === sent) setDraft(inputOf(journey));
      return journey;
    } catch (e) {
      setError(journeyErrorText(e, "Could not save the journey."));
      return null;
    }
  };

  const saveNow = async () => {
    if (!dirty || busy || uploading) return;
    if (locked && items.length) {
      go(items[0]!);
      return setError("Fix what is marked first.");
    }
    if (await persist()) showSuccessNotification("Changes saved");
  };

  const launch = async () => {
    const journey = dirty ? await persist() : saved;
    if (!journey) return setReviewing(false);
    try {
      await step.mutateAsync({ id: journey.id, action: "launch" });
      showSuccessNotification("The journey is live");
      onClose();
      router.push(`/journeys/${journey.id}`);
    } catch (e) {
      const message = journeyErrorText(e, "Could not launch the journey.");
      setError(message);
      showErrorNotification(message);
      setReviewing(false);
    }
  };

  const latest = useRef({ saveNow, selected, current, locked });
  useEffect(() => {
    latest.current = { saveNow, selected, current, locked };
  });
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void latest.current.saveNow();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onMapKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Delete" && e.key !== "Backspace") return;
    if (locked || !current || typing(e.target)) return;
    if ((e.target as HTMLElement).closest("[role=menu]")) return;
    e.preventDefault();
    remove(current.id);
  };

  useEffect(() => {
    closeRef.current = () =>
      dirty || uploading ? setLeaving(true) : onClose();
    escapeRef.current = () => {
      if (!latest.current.selected) return false;
      select(null);
      return true;
    };
    return () => {
      closeRef.current = null;
      escapeRef.current = null;
    };
  }, [closeRef, escapeRef, dirty, uploading, onClose]);

  const close = () => select(null);

  return (
    <>
      <DialogHeader>
        <div className="flex w-full min-w-0 items-center gap-3 px-5 py-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <Route className="size-4" />
          </span>
          <DialogTitle className="shrink-0 text-[15px] font-semibold">
            {fresh ? "Create journey" : "Edit journey"}
          </DialogTitle>
          <span aria-hidden className="h-5 w-px shrink-0 bg-sidebar-border" />
          <NameField
            name={draft.name}
            disabled={saved.status === "ended"}
            onChange={(name) => name !== draft.name && set({ name })}
          />
          <JourneyStatusPill status={saved.status} />
          <span
            role="status"
            className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground"
          >
            {save.isPending ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Saving…
              </>
            ) : dirty ? (
              <>
                <span className="size-1.5 rounded-full bg-amber-500" />
                Unsaved changes
              </>
            ) : (
              "All changes saved"
            )}
          </span>
          <button
            type="button"
            className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={() => closeRef.current?.()}
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>
      </DialogHeader>
      <Separator />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative flex min-h-0 flex-1">
          <MapViewport
            autoFit
            onKeyDown={onMapKey}
            onBackground={() => select(null)}
          >
            <JourneyMap
              editor
              draft={draft}
              segmentName={segmentName}
              selected={panel}
              onSelect={select}
              onInsert={locked ? undefined : insert}
              onContinue={locked ? undefined : join}
              problems={found}
            />
          </MapViewport>
          {undo && (
            <div
              role="status"
              className="absolute bottom-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-sidebar-border bg-background py-2 pl-3.5 pr-2 text-[13px] shadow-md"
            >
              {undo.text}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-primary"
                onClick={restore}
              >
                Undo
              </Button>
            </div>
          )}
          <aside
            aria-label={
              current
                ? "Step settings"
                : panel === SETTINGS
                  ? "Starts when"
                  : panel === GOALS
                    ? "Leaves when"
                    : "Overview"
            }
            className="flex w-[420px] min-w-0 shrink-0 flex-col border-l border-sidebar-border bg-background"
          >
            {current ? (
              <StepPanel
                key={current.id}
                projectId={projectId}
                draft={draft}
                step={current}
                locked={locked}
                problems={found.steps[current.id] ?? []}
                onChange={onStep}
                uploadImage={uploadImage}
                onDelete={(keep) => remove(current.id, keep)}
                onBack={close}
              />
            ) : panel === SETTINGS ? (
              <>
                <PanelHeader
                  icon={<Zap className="size-4" />}
                  title="Starts when…"
                  hint="What puts someone in the journey, and who may."
                  onBack={close}
                />
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                  {found.entry.map((p) => (
                    <FieldError key={p} message={p} />
                  ))}
                  <EntrySection
                    projectId={projectId}
                    draft={draft}
                    locked={locked}
                    set={set}
                  />
                </div>
              </>
            ) : panel === GOALS ? (
              <>
                <PanelHeader
                  icon={<Flag className="size-4" />}
                  title="Leaves when…"
                  hint="Goals that take people out as converted."
                  onBack={close}
                />
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                  {found.goals.map((p) => (
                    <FieldError key={p} message={p} />
                  ))}
                  <GoalsSection
                    projectId={projectId}
                    draft={draft}
                    locked={locked}
                    set={set}
                  />
                </div>
              </>
            ) : (
              <>
                <PanelHeader
                  icon={<LayoutList className="size-4" />}
                  title="Overview"
                  hint="What the journey still needs, and how it is measured."
                />
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
                  {items.length > 0 && (
                    <section className="space-y-2">
                      <h4 className="text-[13px] font-semibold">
                        {locked ? "To fix before saving" : "Before you launch"}
                      </h4>
                      <Checklist items={items} onGo={go} />
                    </section>
                  )}
                  <LockedNote locked={locked} />
                  <section className="space-y-2">
                    <h4 className="text-[13px] font-semibold">Control group</h4>
                    <ControlGroupSection
                      projectId={projectId}
                      draft={draft}
                      locked={locked}
                      set={set}
                      projectControlGroup={projectControlGroup}
                    />
                  </section>
                  <section className="space-y-2">
                    <h4 className="text-[13px] font-semibold">Schedule</h4>
                    <ScheduleSection
                      projectId={projectId}
                      draft={draft}
                      locked={locked}
                      set={set}
                    />
                  </section>
                </div>
              </>
            )}
          </aside>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-sidebar-border px-5 py-3">
          <div className="min-w-0 flex-1">
            {error ? (
              <FieldError message={error} />
            ) : (
              locked && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3" />
                  Live — only messages and timings can change
                </span>
              )
            )}
          </div>
          <Button
            variant={locked ? "default" : "outline"}
            disabled={!dirty || busy || uploading}
            title={uploading ? WAITING : "Save (⌘S)"}
            onClick={() => void saveNow()}
          >
            {save.isPending && !reviewing && (
              <Loader2 className="size-4 animate-spin" />
            )}
            Save
          </Button>
          {!locked && (
            <Button
              disabled={busy || uploading || items.length > 0}
              title={
                uploading
                  ? WAITING
                  : items.length
                    ? "Fix what the overview lists first"
                    : undefined
              }
              onClick={() => setReviewing(true)}
            >
              Launch
            </Button>
          )}
        </div>
      </div>

      <ReviewDialog
        open={reviewing}
        onOpenChange={setReviewing}
        draft={draft}
        items={items}
        segmentName={segmentName}
        projectControlGroup={projectControlGroup}
        busy={busy}
        onGo={go}
        onLaunch={() => void launch()}
      />
      <ActionConfirm
        open={!!removing}
        setOpen={(open) => !open && setRemoving(null)}
        title="Remove this step?"
        description={
          removing
            ? `${waitsOn(draft, removing.id)
                .map((w) => stepLabel(draft, w.id))
                .join(
                  ", "
                )} waits for it: it will wait for nothing, and its Time ran out path and ${removing.lost} step${removing.lost === 1 ? "" : "s"} go too.`
            : ""
        }
        confirmText="Remove"
        cancelText="Keep it"
        onConfirm={() => {
          if (removing) remove(removing.id, undefined, true);
          setRemoving(null);
        }}
      />
      <ActionConfirm
        open={leaving}
        setOpen={setLeaving}
        title="Close without saving?"
        description="The changes you made since the last save will be lost."
        confirmText="Discard changes"
        cancelText="Keep editing"
        onConfirm={onClose}
      />
    </>
  );
}
