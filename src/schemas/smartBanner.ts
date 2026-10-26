import { z } from "zod";

export const ICON_MAX_BYTES = 1_048_576;
export const ICON_TYPES = ["image/png", "image/jpeg", "image/webp"];
// Mirrors the backend SmartBanner validations.
export const SMART_BANNER_LIMITS = {
  name: 100,
  title: 80,
  subtitle: 120,
  buttonText: 24,
  pattern: 256,
  patterns: 20,
} as const;
const HEX = /^#[0-9A-Fa-f]{6}$/;

// A bare * means every page, which the backend spells /*.
export const parsePatterns = (text: string): string[] =>
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l === "*" ? "/*" : l));

const patternIssues = (text: string): string[] => {
  const list = parsePatterns(text);
  const issues: string[] = [];
  if (list.length > SMART_BANNER_LIMITS.patterns)
    issues.push(`At most ${SMART_BANNER_LIMITS.patterns} patterns`);
  if (list.some((p) => !p.startsWith("/")))
    issues.push("Each pattern must start with /");
  if (list.some((p) => p.length > SMART_BANNER_LIMITS.pattern))
    issues.push(
      `Each pattern can have at most ${SMART_BANNER_LIMITS.pattern} characters`
    );
  return issues;
};

const patterns = z.string().superRefine((text, ctx) => {
  patternIssues(text).forEach((message) =>
    ctx.addIssue({ code: "custom", message })
  );
});

export const INCLUDE_REQUIRED =
  "Add at least one page, or turn on Show on all pages";

const color = z.string().regex(HEX, "Use a #RRGGBB color");
const text = (label: string, max: number) =>
  z.string().trim().max(max, `${label} can have at most ${max} characters`);
const required = (label: string, max: number) =>
  text(label, max).min(1, `${label} is required`);

const days = z
  .number({ message: "Enter a number" })
  .int("Whole days only")
  .min(0, "0 to 365")
  .max(365, "0 to 365");

export const smartBannerSchema = z
  .object({
    name: required("Name", SMART_BANNER_LIMITS.name),
    platforms: z
      .array(z.enum(["ios", "android"]))
      .min(1, "Pick at least one platform"),
    all_pages: z.boolean(),
    // Checked below, and only when the banner is limited to some pages.
    url_include: z.string(),
    url_exclude: patterns,
    position: z.enum(["top", "bottom"]),
    title: required("Title", SMART_BANNER_LIMITS.title),
    subtitle: text("Subtitle", SMART_BANNER_LIMITS.subtitle),
    button_text: required("Button text", SMART_BANNER_LIMITS.buttonText),
    background_color: color,
    text_color: color,
    button_color: color,
    button_text_color: color,
    dismiss_days: days,
    open_hide_days: days,
    icon: z
      .instanceof(File)
      .nullable()
      .refine((f) => !f || ICON_TYPES.includes(f.type), "PNG, JPG or WebP only")
      .refine((f) => !f || f.size <= ICON_MAX_BYTES, "Max 1 MB"),
    remove_icon: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.all_pages) return;
    const issues = parsePatterns(v.url_include).length
      ? patternIssues(v.url_include)
      : [INCLUDE_REQUIRED];
    issues.forEach((message) =>
      ctx.addIssue({ code: "custom", path: ["url_include"], message })
    );
  });

export type SmartBannerFormValues = z.infer<typeof smartBannerSchema>;

export const SMART_BANNER_DEFAULTS: SmartBannerFormValues = {
  name: "",
  platforms: ["ios", "android"],
  all_pages: true,
  url_include: "",
  url_exclude: "",
  position: "top",
  title: "",
  subtitle: "",
  button_text: "Open",
  background_color: "#FFFFFF",
  text_color: "#111827",
  button_color: "#2563EB",
  button_text_color: "#FFFFFF",
  dismiss_days: 7,
  open_hide_days: 30,
  icon: null,
  remove_icon: false,
};
