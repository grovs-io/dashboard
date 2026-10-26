export type QuickAction =
  | { type: "close" }
  | { type: "open"; url: string }
  | { type: "track"; event: string };

export interface ButtonValue {
  // Null when the button holds more than text, such as an icon: only its action is offered.
  text: string | null;
  action: QuickAction;
}

interface Base {
  key: string;
  label: string;
}

export type Field =
  | (Base & { kind: "text"; value: string })
  | (Base & { kind: "image" | "video" | "audio"; value: string })
  | (Base & { kind: "button"; value: ButtonValue })
  | (Base & { kind: "color"; property: string; value: string });

const EDIT = "[data-grovs-edit]";
const COLOR = "[data-grovs-edit-color]";

const parse = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

const onlyText = (el: Element) => el.children.length === 0;

const shown = (text: string | null) => (text ?? "").replace(/\s+/g, " ").trim();

const colorLabel = (property: string) => {
  const name = property.replace(/^--/, "").replace(/[-_]+/g, " ").trim();
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} colour`;
};

const declaration = (property: string) =>
  new RegExp(
    `(^|;)(\\s*)${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:[^;]*`
  );

const readProperty = (style: string, property: string) =>
  (declaration(property).exec(style)?.[0] ?? "").replace(/^[^:]*:/, "").trim();

// The text, not the CSSOM: setProperty rewrites the attribute and drops what it can't parse.
function writeProperty(style: string, property: string, value: string) {
  if (declaration(property).test(style))
    return style.replace(
      declaration(property),
      (_, start: string, space: string) =>
        `${start}${space}${property}: ${value}`
    );
  const kept = style.trim().replace(/;$/, "");
  return kept ? `${kept}; ${property}: ${value}` : `${property}: ${value}`;
}

const colorProperties = (el: Element) =>
  (el.getAttribute("data-grovs-edit-color") ?? "")
    .split(/\s+/)
    .filter((p) => p.startsWith("--"));

function actionOf(el: Element): QuickAction | null {
  const type = el.getAttribute("data-grovs-action");
  if (type === "close") return { type };
  if (type === "open")
    return { type, url: el.getAttribute("data-grovs-url") ?? "" };
  if (type === "track")
    return { type, event: el.getAttribute("data-grovs-event") ?? "" };
  return null;
}

const mediaTarget = (el: Element) =>
  !el.hasAttribute("src") && el.querySelector("source")
    ? el.querySelector("source")!
    : el;

interface Found {
  field: Field;
  el: Element;
}

function find(doc: Document): Found[] {
  const edits = [...doc.querySelectorAll(EDIT)];
  const colors = [...doc.querySelectorAll(COLOR)];
  const found: Found[] = [];
  for (const el of doc.querySelectorAll(`${EDIT}, ${COLOR}`)) {
    if (el.matches(COLOR)) {
      const at = colors.indexOf(el);
      for (const property of colorProperties(el))
        found.push({
          el,
          field: {
            kind: "color",
            key: `color:${at}:${property}`,
            label: colorLabel(property),
            property,
            value: readProperty(el.getAttribute("style") ?? "", property),
          },
        });
    }
    if (!el.matches(EDIT)) continue;
    const key = `edit:${edits.indexOf(el)}`;
    const label = el.getAttribute("data-grovs-edit")!.trim() || "Untitled";
    const action = actionOf(el);
    const tag = el.localName;
    if (tag === "img")
      found.push({
        el,
        field: {
          kind: "image",
          key,
          label,
          value: el.getAttribute("src") ?? "",
        },
      });
    else if (tag === "video" || tag === "audio")
      found.push({
        el,
        field: {
          kind: tag,
          key,
          label,
          value: mediaTarget(el).getAttribute("src") ?? "",
        },
      });
    else if (action)
      found.push({
        el,
        field: {
          kind: "button",
          key,
          label,
          value: {
            text: onlyText(el) ? shown(el.textContent) : null,
            action,
          },
        },
      });
    // Text holding other elements would lose them; an element wired by a script keeps its wiring.
    else if (onlyText(el))
      found.push({
        el,
        field: { kind: "text", key, label, value: shown(el.textContent) },
      });
  }
  return found;
}

export const fieldsOf = (html: string): Field[] =>
  html.trim() ? find(parse(html)).map((f) => f.field) : [];

// The HTML serializer, never XMLSerializer: scripts and styles stay as written, and no xmlns appears.
function serialize(original: string, doc: Document) {
  const doctype = /<!doctype[^>]*>/i.exec(original)?.[0] ?? "<!doctype html>";
  const parts = [...doc.childNodes].map((node) =>
    node.nodeType === Node.DOCUMENT_TYPE_NODE
      ? doctype
      : node.nodeType === Node.COMMENT_NODE
        ? `<!--${(node as Comment).data}-->`
        : node.nodeType === Node.ELEMENT_NODE
          ? (node as Element).outerHTML
          : ""
  );
  const tail = /\s*$/.exec(original)?.[0] ?? "";
  return `${parts.filter(Boolean).join("\n")}${tail}`;
}

function setAction(el: Element, action: QuickAction) {
  el.setAttribute("data-grovs-action", action.type);
  if (action.type === "open") el.setAttribute("data-grovs-url", action.url);
  else el.removeAttribute("data-grovs-url");
  if (action.type === "track")
    el.setAttribute("data-grovs-event", action.event);
  else el.removeAttribute("data-grovs-event");
}

export function applyField<F extends Field>(
  html: string,
  field: F,
  value: F["value"],
  // An image's own size, when the new picture's is known.
  size?: { width: number; height: number }
): string {
  const doc = parse(html);
  const found = find(doc).find(
    (f) =>
      f.field.key === field.key &&
      f.field.kind === field.kind &&
      f.field.label === field.label
  );
  if (!found) return html;
  const { el } = found;
  switch (field.kind) {
    case "text":
      el.textContent = value as string;
      break;
    case "image":
      el.setAttribute("src", value as string);
      el.removeAttribute("srcset");
      if (size) {
        el.setAttribute("width", String(size.width));
        el.setAttribute("height", String(size.height));
      }
      break;
    case "video":
    case "audio":
      mediaTarget(el).setAttribute("src", value as string);
      break;
    case "button": {
      const { text, action } = value as ButtonValue;
      if (text !== null && onlyText(el)) el.textContent = text;
      setAction(el, action);
      break;
    }
    case "color":
      el.setAttribute(
        "style",
        writeProperty(
          el.getAttribute("style") ?? "",
          field.property,
          value as string
        )
      );
      break;
  }
  return serialize(html, doc);
}
