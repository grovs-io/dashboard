"use client";
import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ExternalLink,
  Loader2,
  PanelBottom,
  PanelTop,
  Smartphone,
  X,
} from "lucide-react";
import ActionConfirm from "@/components/common/action-confirm";
import { FieldError } from "@/components/common/FieldError";
import ColorField from "@/components/composer/ColorField";
import ComposerNav from "@/components/composer/ComposerNav";
import { Field } from "@/components/composer/fields";
import OptionCard from "@/components/composer/OptionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useProjectSelection } from "@/context/useProjectSelection";
import {
  useCreateSmartBannerMutation,
  useUpdateSmartBannerMutation,
} from "@/hooks/mutations/useSmartBannersMutations";
import { getApiErrorInfo } from "@/lib/ApiError";
import {
  showErrorNotification,
  showSuccessNotification,
} from "@/lib/Notifications";
import {
  bannerToFormValues,
  buildSmartBannerFormData,
} from "@/lib/smartBanners";
import {
  ICON_TYPES,
  SMART_BANNER_DEFAULTS,
  SMART_BANNER_LIMITS,
  smartBannerSchema,
  type SmartBannerFormValues,
} from "@/schemas/smartBanner";
import type {
  SmartBanner,
  SmartBannerPlatform,
  SmartBannerState,
} from "@/types";
import AppIconField from "./AppIconField";
import HidePeriodField from "./HidePeriodField";
import { SmartBannerPreviewPanel } from "./SmartBannerPreview";

export type CloseRef = MutableRefObject<(() => void) | null>;

const SECTIONS = [
  "details",
  "targeting",
  "content",
  "style",
  "behaviour",
] as const;
type Section = (typeof SECTIONS)[number];

const LABELS: Record<Section, string> = {
  details: "Details",
  targeting: "Targeting",
  content: "Content",
  style: "Style",
  behaviour: "Behaviour",
};

const META: Record<Section, string> = {
  details: "What the banner is called and which phones see it.",
  targeting: "The pages of your site the banner shows on.",
  content: "What visitors read, and the button that opens the app.",
  style: "Where the banner sits and its colours.",
  behaviour:
    "After a visitor closes the banner or taps Open, hide it from them for a while.",
};

export const FIELDS: Record<Section, (keyof SmartBannerFormValues)[]> = {
  details: ["name", "platforms"],
  targeting: ["all_pages", "url_include", "url_exclude"],
  content: ["title", "subtitle", "button_text", "icon", "remove_icon"],
  style: [
    "position",
    "background_color",
    "text_color",
    "button_color",
    "button_text_color",
  ],
  behaviour: ["dismiss_days", "open_hide_days"],
};

const HIDE_FIELDS = [
  {
    name: "dismiss_days",
    title: "When a visitor closes it",
    description: "They tapped ×. Wait before showing it to them again.",
    icon: <X className="size-4" />,
  },
  {
    name: "open_hide_days",
    title: "When a visitor taps Open",
    description: "They already went to your app or the store.",
    icon: <ExternalLink className="size-4" />,
  },
] as const;

const COLORS = [
  ["background_color", "Background", "#FFFFFF"],
  ["text_color", "Text", "#111827"],
  ["button_color", "Button", "#2563EB"],
  ["button_text_color", "Button text", "#FFFFFF"],
] as const;

const PLATFORMS: { value: SmartBannerPlatform; title: string; hint: string }[] =
  [
    {
      value: "ios",
      title: "iOS",
      hint: "iPhone visitors, in Safari and other browsers",
    },
    {
      value: "android",
      title: "Android",
      hint: "Android visitors, in Chrome and other browsers",
    },
  ];

// Fields with their own inline error; the footer spells out the rest.
const INLINE = new Set<string>([
  "name",
  "platforms",
  "url_include",
  "url_exclude",
  "title",
  "subtitle",
  "icon",
  "button_text",
  "dismiss_days",
  "open_hide_days",
]);

export const sectionOf = (field: string): Section | undefined =>
  SECTIONS.find((s) =>
    FIELDS[s].includes(field as keyof SmartBannerFormValues)
  );

const hasErrors = (
  errors: FieldErrors<SmartBannerFormValues>,
  section: Section
) => FIELDS[section].some((f) => !!errors[f]);

const charHint = (max: number, optional = false) =>
  `${optional ? "Optional. " : ""}Up to ${max} characters.`;

const SAVED: Partial<Record<SmartBannerState, string>> = {
  draft: "Draft saved",
  live: "Banner published",
};

export default function SmartBannerComposer({
  banner,
  domain,
  closeRef,
  onClose,
  onDirtyChange,
}: {
  banner?: SmartBanner;
  // The linked website, shown in the preview's address bar.
  domain?: string;
  // The dialog's close asks here first, so unsaved changes get a confirm.
  closeRef: CloseRef;
  onClose: () => void;
  // Lets the dialog's header lock status actions while there are unsaved changes.
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { selectedProject } = useProjectSelection();
  const create = useCreateSmartBannerMutation(selectedProject?.id);
  const update = useUpdateSmartBannerMutation(selectedProject?.id);
  const [section, setSection] = useState<Section>("details");
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const form = useForm<SmartBannerFormValues>({
    resolver: zodResolver(smartBannerSchema),
    defaultValues: banner ? bannerToFormValues(banner) : SMART_BANNER_DEFAULTS,
  });
  const { register, handleSubmit, watch, setValue, formState } = form;
  const errors = formState.errors;
  const v = watch();
  const shown = formState.submitCount > 0;
  const saving = create.isPending || update.isPending;
  // Which footer button is saving: a status, or "save" for keeping the current one.
  const [intent, setIntent] = useState<SmartBannerState | "save" | null>(null);
  const draft = !banner || banner.status === "draft";

  // Checked on every change, so the steps can say which are ready, as in the in-app composer.
  const problems = useMemo(() => {
    const result = smartBannerSchema.safeParse(v);
    const found = new Set<Section>();
    if (!result.success)
      result.error.issues.forEach((i) => {
        const at = sectionOf(String(i.path[0]));
        if (at) found.add(at);
      });
    return found;
  }, [v]);

  // Object URL for a newly picked icon, created and revoked by the same effect.
  const [pickedUrl, setPickedUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!v.icon) {
      setPickedUrl(null);
      return;
    }
    const url = URL.createObjectURL(v.icon);
    setPickedUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [v.icon]);
  const iconUrl =
    pickedUrl ?? (v.remove_icon ? null : (banner?.icon_url ?? null));

  const onIcon = (file: File | null) => {
    if (file) {
      setValue("icon", file, { shouldValidate: true, shouldDirty: true });
      setValue("remove_icon", false);
    } else if (v.icon)
      setValue("icon", null, { shouldValidate: true, shouldDirty: true });
    else setValue("remove_icon", true, { shouldDirty: true });
  };

  const dirty = formState.isDirty;
  // Editing an existing banner: saving is only offered once something changed.
  const unchanged = !!banner && !dirty;
  useEffect(() => {
    closeRef.current = () => (dirty ? setConfirmDiscard(true) : onClose());
    onDirtyChange?.(dirty);
    return () => {
      closeRef.current = null;
      onDirtyChange?.(false); // unlock dialog header on unmount
    };
  }, [closeRef, dirty, onClose, onDirtyChange]);

  // Focus the first wrong field once its section has rendered.
  const [focusField, setFocusField] = useState<
    keyof SmartBannerFormValues | null
  >(null);
  useEffect(() => {
    if (!focusField) return;
    form.setFocus(focusField);
    setFocusField(null);
  }, [focusField, form]);

  const onValid =
    (status?: SmartBannerState) => async (values: SmartBannerFormValues) => {
      setError(null);
      const fd = buildSmartBannerFormData(values, status);
      try {
        if (banner) await update.mutateAsync({ id: banner.id, fd });
        else await create.mutateAsync(fd);
        showSuccessNotification((status && SAVED[status]) ?? "Banner saved");
        onClose();
      } catch (e) {
        const message = getApiErrorInfo(e).message;
        setError(message);
        showErrorNotification(message);
      }
    };
  const submit = (status?: SmartBannerState) => {
    setIntent(status ?? "save");
    void handleSubmit(onValid(status), onInvalid)();
  };

  const onInvalid = (found: FieldErrors<SmartBannerFormValues>) => {
    const hidden = Object.entries(found)
      .filter(([k]) => !INLINE.has(k))
      .map(([k, e]) => `${k.replace(/_/g, " ")}: ${e?.message ?? "invalid"}`);
    setError(
      hidden.length
        ? `Fix before saving: ${hidden.join("; ")}`
        : "Fix the highlighted fields before saving."
    );
    const first = SECTIONS.find((s) => hasErrors(found, s));
    if (!first) return;
    setSection(first);
    setFocusField(FIELDS[first].find((f) => !!found[f]) ?? null);
  };

  const index = SECTIONS.indexOf(section);
  const spinner = <Loader2 className="size-3.5 animate-spin" />;
  const look = {
    position: v.position,
    title: v.title || "Title",
    subtitle: v.subtitle,
    buttonText: v.button_text || "Open",
    backgroundColor: v.background_color,
    textColor: v.text_color,
    buttonColor: v.button_color,
    buttonTextColor: v.button_text_color,
    iconUrl,
  };

  return (
    <>
      <form
        noValidate
        aria-label={banner ? "Edit smart banner" : "Create smart banner"}
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft ? "draft" : undefined);
        }}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <ComposerNav
            label="Banner sections"
            sections={SECTIONS}
            labels={LABELS}
            current={section}
            onSelect={setSection}
            stateOf={(item, i) => {
              // An existing banner is already filled in, so its real state shows from the start.
              const checked = shown || !!banner;
              if (checked && problems.has(item)) return "wrong";
              return (checked || i < index) && !problems.has(item)
                ? "done"
                : "todo";
            }}
          />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1">
              <div className="min-w-0 flex-1 space-y-5 overflow-y-auto p-5">
                <div>
                  <h3 className="text-[15px] font-semibold">
                    {LABELS[section]}
                  </h3>
                  <p className="text-[13px] text-muted-foreground">
                    {META[section]}
                  </p>
                </div>

                {section === "details" && (
                  <div className="space-y-6">
                    <Field label="Name" hint="Only your team sees it.">
                      {(id) => (
                        <>
                          <Input
                            id={id}
                            aria-invalid={!!errors.name}
                            {...register("name")}
                          />
                          <FieldError message={errors.name?.message} />
                        </>
                      )}
                    </Field>
                    <div className="space-y-2">
                      <p
                        id="platforms-label"
                        className="text-[13px] font-medium"
                      >
                        Platforms
                      </p>
                      <div
                        role="group"
                        aria-labelledby="platforms-label"
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        {PLATFORMS.map((p) => {
                          const on = v.platforms.includes(p.value);
                          return (
                            <OptionCard
                              key={p.value}
                              multiple
                              selected={on}
                              title={p.title}
                              hint={p.hint}
                              icon={<Smartphone className="size-4" />}
                              onSelect={() =>
                                setValue(
                                  "platforms",
                                  on
                                    ? v.platforms.filter((x) => x !== p.value)
                                    : [...v.platforms, p.value],
                                  { shouldValidate: shown, shouldDirty: true }
                                )
                              }
                            />
                          );
                        })}
                      </div>
                      <FieldError message={errors.platforms?.message} />
                    </div>
                  </div>
                )}

                {section === "targeting" && (
                  <div className="space-y-6">
                    <label className="flex items-center justify-between gap-4 rounded-lg border border-sidebar-border p-3.5">
                      <span>
                        <span className="block text-[13px] font-medium">
                          Show on all pages
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          Turn off to pick the pages it shows on.
                        </span>
                      </span>
                      <Switch
                        checked={v.all_pages}
                        onCheckedChange={(on) =>
                          setValue("all_pages", on, {
                            shouldValidate: shown,
                            shouldDirty: true,
                          })
                        }
                        aria-label="Show on all pages"
                      />
                    </label>
                    {!v.all_pages && (
                      <Field
                        label="Only on pages"
                        hint="One path per line, starting with /. * matches anything, e.g. /products/* or /blog/*."
                      >
                        {(id) => (
                          <>
                            <Textarea
                              id={id}
                              rows={4}
                              placeholder={"/products/*\n/blog/*"}
                              aria-invalid={!!errors.url_include}
                              {...register("url_include")}
                            />
                            <FieldError message={errors.url_include?.message} />
                          </>
                        )}
                      </Field>
                    )}
                    <Field
                      label="Except on pages"
                      hint={
                        v.all_pages
                          ? "Optional. Pages to leave out, e.g. /checkout*."
                          : "Optional. Wins over the pages above, e.g. /checkout*."
                      }
                    >
                      {(id) => (
                        <>
                          <Textarea
                            id={id}
                            rows={3}
                            placeholder="/checkout*"
                            aria-invalid={!!errors.url_exclude}
                            {...register("url_exclude")}
                          />
                          <FieldError message={errors.url_exclude?.message} />
                        </>
                      )}
                    </Field>
                  </div>
                )}

                {section === "content" && (
                  <div className="space-y-6">
                    <AppIconField
                      url={iconUrl}
                      accept={ICON_TYPES.join(",")}
                      error={errors.icon?.message}
                      onFile={onIcon}
                    />
                    <Field
                      label="Title"
                      hint={charHint(SMART_BANNER_LIMITS.title)}
                    >
                      {(id) => (
                        <>
                          <Input
                            id={id}
                            aria-invalid={!!errors.title}
                            {...register("title")}
                          />
                          <FieldError message={errors.title?.message} />
                        </>
                      )}
                    </Field>
                    <Field
                      label="Subtitle"
                      hint={charHint(SMART_BANNER_LIMITS.subtitle, true)}
                    >
                      {(id) => (
                        <>
                          <Input
                            id={id}
                            aria-invalid={!!errors.subtitle}
                            {...register("subtitle")}
                          />
                          <FieldError message={errors.subtitle?.message} />
                        </>
                      )}
                    </Field>
                    <Field
                      label="Button text"
                      hint={charHint(SMART_BANNER_LIMITS.buttonText)}
                    >
                      {(id) => (
                        <>
                          <Input
                            id={id}
                            aria-invalid={!!errors.button_text}
                            {...register("button_text")}
                          />
                          <FieldError message={errors.button_text?.message} />
                        </>
                      )}
                    </Field>
                  </div>
                )}

                {section === "style" && (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <p
                        id="position-label"
                        className="text-[13px] font-medium"
                      >
                        Position
                      </p>
                      <div
                        role="radiogroup"
                        aria-labelledby="position-label"
                        className="grid gap-3 sm:grid-cols-2"
                      >
                        <OptionCard
                          selected={v.position === "top"}
                          title="Top"
                          hint="Above the page; fixed headers move down"
                          icon={<PanelTop className="size-4" />}
                          onSelect={() =>
                            setValue("position", "top", { shouldDirty: true })
                          }
                        />
                        <OptionCard
                          selected={v.position === "bottom"}
                          title="Bottom"
                          hint="Fixed to the bottom of the screen"
                          icon={<PanelBottom className="size-4" />}
                          onSelect={() =>
                            setValue("position", "bottom", {
                              shouldDirty: true,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground">
                        Colours
                      </p>
                      <div className="divide-y divide-sidebar-border overflow-hidden rounded-lg border border-sidebar-border">
                        {COLORS.map(([name, label, fallback]) => (
                          <ColorField
                            key={name}
                            label={label}
                            value={v[name]}
                            fallback={fallback}
                            automatic={false}
                            hexOnly
                            onChange={(next) =>
                              setValue(name, next ?? fallback, {
                                shouldValidate: shown,
                                shouldDirty: true,
                              })
                            }
                          />
                        ))}
                      </div>
                      {COLORS.map(([name]) => (
                        <FieldError
                          key={name}
                          message={errors[name]?.message}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {section === "behaviour" && (
                  <div className="space-y-3">
                    {HIDE_FIELDS.map(({ name, title, description, icon }) => (
                      <HidePeriodField
                        key={name}
                        id={name}
                        icon={icon}
                        title={title}
                        description={description}
                        value={v[name]}
                        error={errors[name]?.message}
                        onChange={(days) =>
                          setValue(name, days, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
              <aside className="hidden w-[320px] shrink-0 overflow-y-auto border-l border-sidebar-border bg-sidebar p-5 lg:block">
                <SmartBannerPreviewPanel
                  look={look}
                  platforms={v.platforms}
                  domain={domain}
                />
              </aside>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-sidebar-border px-5 py-3">
              <div className="min-w-0 flex-1 space-y-1">
                <FieldError message={error ?? undefined} />
              </div>
              {index < SECTIONS.length - 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSection(SECTIONS[index + 1] ?? section)}
                >
                  Next
                </Button>
              )}
              {draft ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={saving || unchanged}
                    onClick={() => submit("draft")}
                  >
                    {saving && intent === "draft" && spinner}
                    Save draft
                  </Button>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => submit("live")}
                  >
                    {saving && intent === "live" && spinner}
                    Publish
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  disabled={saving || unchanged}
                  onClick={() => submit()}
                >
                  {saving && spinner}
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
      <ActionConfirm
        open={confirmDiscard}
        setOpen={setConfirmDiscard}
        title="Close without saving?"
        description="The changes you made will be lost."
        confirmText="Discard changes"
        cancelText="Keep editing"
        onConfirm={onClose}
      />
    </>
  );
}
