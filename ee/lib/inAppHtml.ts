import { linkAllowed, resourceAllowed } from "@ee/lib/inAppLinkRule";
import {
  IN_APP_LAYOUTS,
  type InAppLayout,
  type InAppMedia,
} from "@ee/types/inApp";

// The same checks the server runs on a custom HTML message (InAppDefinition.html_rules).
export const HTML_MAX_BYTES = 64 * 1024;

const URL_ATTRS = ["href", "src", "poster", "srcset", "data-grovs-url"];

// bridge.js's FIELD: groups are the source, the key and the default.
export const HTML_FIELD =
  /\{\{\s*(user|event)\.([A-Za-z0-9_]+)\s*(?:\|\s*default:\s*"([^"]*)"\s*)?\}\}/g;

export const htmlBytes = (html: string) =>
  new TextEncoder().encode(html).length;

const parse = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

// The server also looks inside <template> contents, which querySelectorAll skips.
const all = (root: ParentNode, selector: string): Element[] => [
  ...root.querySelectorAll(selector),
  ...[...root.querySelectorAll("template")].flatMap((t) =>
    all(t.content, selector)
  ),
];

// URL attributes are never filled, so {{ there gets its own problem instead.
const fillable = (value: string | null) => (value ?? "").includes("{{");

// Whitespace below is Ruby's \s, as the server reads it. The HTML spec's candidate grammar: a data: URI's own commas are not separators.
export function srcsetUrls(value: string): string[] {
  const urls: string[] = [];
  let at = 0;
  const skip = (pattern: RegExp) => {
    const match = pattern.exec(value.slice(at));
    if (match) at += match[0].length;
    return match?.[0];
  };
  while (at < value.length) {
    skip(/^[\t\n\v\f\r ,]+/);
    const url = skip(/^[^\t\n\v\f\r ]+/);
    if (!url) break;
    if (url.endsWith(",")) {
      urls.push(url.replace(/,+$/, ""));
    } else {
      urls.push(url);
      skip(/^[\t\n\v\f\r ]+/);
      skip(/^[^,]*/);
      skip(/^,/);
    }
  }
  return urls;
}

const styleUrls = (value: string | null) =>
  [
    ...(value ?? "").matchAll(
      /url\([\t\n\v\f\r ]*['"]?([^'")]+)['"]?[\t\n\v\f\r ]*\)/gi
    ),
  ].map((m) => m[1]!);

function badLink(doc: Document): boolean {
  return [
    ...all(doc, "a[href]").map((el) => el.getAttribute("href")),
    ...all(doc, "[data-grovs-url]").map((el) =>
      el.getAttribute("data-grovs-url")
    ),
  ].some((url) => !fillable(url) && !linkAllowed(url ?? ""));
}

function badResource(doc: Document): boolean {
  const bad = (url: string | null, image: boolean) =>
    !fillable(url) && !resourceAllowed(url ?? "", image);
  return (
    all(doc, "[src]").some((el) =>
      bad(el.getAttribute("src"), el.localName === "img")
    ) ||
    all(doc, "[poster]").some((el) => bad(el.getAttribute("poster"), true)) ||
    all(doc, "link[href]").some((el) => bad(el.getAttribute("href"), false)) ||
    all(doc, "[srcset]").some((el) => {
      const value = el.getAttribute("srcset");
      return (
        !fillable(value) &&
        srcsetUrls(value ?? "").some((url) => !resourceAllowed(url, true))
      );
    }) ||
    all(doc, "[style]").some((el) =>
      styleUrls(el.getAttribute("style")).some(
        (url) => !resourceAllowed(url, false)
      )
    )
  );
}

function fieldInUrl(doc: Document): string[] {
  const offenders = all(doc, URL_ATTRS.map((a) => `[${a}]`).join(","))
    .flatMap((el) =>
      URL_ATTRS.filter((a) => el.hasAttribute(a)).map(
        (a) => [a, el.getAttribute(a)!] as const
      )
    )
    .filter(([, value]) => value.includes("{{"))
    .slice(0, 3);
  if (!offenders.length) return [];
  const named = offenders.map(([a, value]) => `${a}="${value}"`).join(", ");
  return [
    `The HTML holds {{ inside a URL attribute: ${named}; build personalized URLs with grovs.user.`,
  ];
}

// As Rails' present?: an attribute of only whitespace is not there.
const present = (value: string | null) =>
  !/^\p{White_Space}*$/u.test(value ?? "");

const unsized = (el: Element) =>
  !(present(el.getAttribute("width")) && present(el.getAttribute("height"))) &&
  !/aspect-ratio[\t\n\v\f\r ]*:/i.test(el.getAttribute("style") ?? "");

function check(html: string): { problems: string[]; warnings: string[] } {
  if (!html.trim())
    return { problems: ["The HTML cannot be empty."], warnings: [] };
  const doc = parse(html);
  // Unsized media only makes the message jump as it loads: a warning, never a reason to refuse.
  const count = all(doc, "img, video").filter(unsized).length;
  const warnings = count
    ? [
        `The HTML has ${count} unsized ${count === 1 ? "image or video" : "images or videos"} that may make the message jump.`,
      ]
    : [];
  if (htmlBytes(html) > HTML_MAX_BYTES)
    return { problems: ["The HTML is larger than 64 KB."], warnings };
  const problems: string[] = [];
  if (all(doc, "base").length)
    problems.push("The HTML cannot use a <base> tag.");
  if (
    all(doc, "meta").some(
      (el) => el.getAttribute("http-equiv")?.toLowerCase() === "refresh"
    )
  )
    problems.push('The HTML cannot use <meta http-equiv="refresh">.');
  if (badLink(doc))
    problems.push("The HTML links to an address that is not allowed.");
  if (badResource(doc))
    problems.push("The HTML loads a resource that is not allowed.");
  return { problems: [...problems, ...fieldInUrl(doc)], warnings };
}

// One parse per HTML, shared by the editor, the step's problems and its warnings.
const seen = new Map<string, ReturnType<typeof check>>();
function checked(html: string) {
  let found = seen.get(html);
  if (!found) {
    if (seen.size >= 8) seen.delete(seen.keys().next().value!);
    seen.set(html, (found = check(html)));
  }
  return found;
}

// Copies: callers add their own problems to the list they get.
export const htmlProblems = (html: string) => [...checked(html).problems];
export const htmlWarnings = (html: string) => [...checked(html).warnings];

const attr = (tag: string, name: string) =>
  new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
    .exec(tag)
    ?.slice(1)
    .find((v) => v !== undefined);

// The layout a design says it is made for: <meta name="grovs-layout" content="full"> in its head.
export function htmlLayout(html: string): InAppLayout | null {
  const head = html.split(/<body[\s>]/i, 1)[0]!;
  for (const [tag] of head.matchAll(/<meta\b[^>]*>/gi)) {
    if (attr(tag, "name")?.toLowerCase() !== "grovs-layout") continue;
    const value = attr(tag, "content")?.trim().toLowerCase();
    return IN_APP_LAYOUTS.find((layout) => layout === value) ?? null;
  }
  return null;
}

const MB = 1024 * 1024;
export const MEDIA_MAX_FILES = 30;
export const MEDIA_MAX_BYTES = 100 * MB;

export type MediaKind = "image" | "video" | "audio";

const KINDS: { kind: MediaKind; types: string[]; ext: RegExp; max: number }[] =
  [
    {
      kind: "image",
      types: ["image/png", "image/jpeg", "image/gif"],
      ext: /\.(png|jpe?g|gif)$/i,
      max: MB,
    },
    { kind: "video", types: ["video/mp4"], ext: /\.mp4$/i, max: 20 * MB },
    {
      kind: "audio",
      types: [
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "audio/x-m4a",
        "audio/m4a",
      ],
      ext: /\.(mp3|m4a)$/i,
      max: 10 * MB,
    },
  ];

export const MEDIA_ACCEPT = [
  ...KINDS.flatMap((k) => k.types),
  ".mp3",
  ".m4a",
].join(",");

// The server decides by the bytes; a browser only knows the name and the type it guessed.
export const mediaKind = (type: string, name = ""): MediaKind | null =>
  KINDS.find((k) => k.types.includes(type) || (!type && k.ext.test(name)))
    ?.kind ?? null;

const TOO_BIG: Record<MediaKind, string> = {
  image: "An image must be under 1 MB.",
  video: "A video must be under 20 MB.",
  audio: "An audio file must be under 10 MB.",
};

export function mediaProblem(file: File, items: InAppMedia[]): string | null {
  const kind = mediaKind(file.type, file.name);
  if (!kind)
    return "Upload a PNG, JPEG or GIF image, an MP4 video, or an MP3 or M4A audio file.";
  if (file.size > KINDS.find((k) => k.kind === kind)!.max) return TOO_BIG[kind];
  if (items.length >= MEDIA_MAX_FILES)
    return `A message holds at most ${MEDIA_MAX_FILES} files. Delete an unused one first.`;
  if (items.reduce((sum, m) => sum + m.bytes, 0) + file.size > MEDIA_MAX_BYTES)
    return "A message holds at most 100 MB of files. Delete an unused one first.";
  return null;
}

// Used in the campaign's own HTML or any variant's, saved or not.
export const mediaUsed = (htmls: string[], url: string) =>
  htmls.some((html) => html.includes(url));

export function mediaTag(
  kind: MediaKind,
  url: string,
  size?: { width: number; height: number }
) {
  const src = url.replaceAll('"', "%22");
  if (kind === "image") {
    const { width, height } = size ?? { width: 600, height: 400 };
    return `<img src="${src}" alt="" width="${width}" height="${height}" style="max-width:100%;height:auto">`;
  }
  if (kind === "video")
    return `<video src="${src}" width="640" height="360" style="width:100%;height:auto" playsinline muted loop autoplay controls></video>`;
  return `<audio src="${src}" controls></audio>`;
}
