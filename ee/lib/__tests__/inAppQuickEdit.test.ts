import { describe, expect, it } from "vitest";
import { applyField, fieldsOf, type Field } from "../inAppQuickEdit";

const page = (body: string, head = "") =>
  `<!doctype html>\n<html lang="en">\n<head>${head}</head>\n<body>${body}</body>\n</html>\n`;

const parse = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

const only = (html: string) => {
  const fields = fieldsOf(html);
  expect(fields).toHaveLength(1);
  return fields[0]!;
};

describe("fieldsOf", () => {
  it("reads each kind of field in document order", () => {
    const html = page(
      `<main data-grovs-edit-color="--brand --accent" style="--brand: #4F46E5; --accent:#F59E0B">
        <h1 data-grovs-edit="Headline">Hello   {{ user.first_name | default: "there" }}</h1>
        <img data-grovs-edit="Hero" src="https://cdn.example/a.png" width="10" height="10" alt="">
        <video data-grovs-edit="Clip" src="https://cdn.example/a.mp4" width="16" height="9"></video>
        <audio data-grovs-edit="Jingle"><source src="https://cdn.example/a.mp3"></audio>
        <button data-grovs-edit="Primary" data-grovs-action="open" data-grovs-url="https://acme.example/x">Go</button>
        <button data-grovs-edit="Later" data-grovs-action="close">Not now</button>
        <a data-grovs-edit="Log" data-grovs-action="track" data-grovs-event="liked">Like</a>
      </main>`
    );
    expect(fieldsOf(html)).toEqual([
      {
        kind: "color",
        key: "color:0:--brand",
        label: "Brand colour",
        property: "--brand",
        value: "#4F46E5",
      },
      {
        kind: "color",
        key: "color:0:--accent",
        label: "Accent colour",
        property: "--accent",
        value: "#F59E0B",
      },
      {
        kind: "text",
        key: "edit:0",
        label: "Headline",
        value: 'Hello {{ user.first_name | default: "there" }}',
      },
      {
        kind: "image",
        key: "edit:1",
        label: "Hero",
        value: "https://cdn.example/a.png",
      },
      {
        kind: "video",
        key: "edit:2",
        label: "Clip",
        value: "https://cdn.example/a.mp4",
      },
      {
        kind: "audio",
        key: "edit:3",
        label: "Jingle",
        value: "https://cdn.example/a.mp3",
      },
      {
        kind: "button",
        key: "edit:4",
        label: "Primary",
        value: {
          text: "Go",
          action: { type: "open", url: "https://acme.example/x" },
        },
      },
      {
        kind: "button",
        key: "edit:5",
        label: "Later",
        value: { text: "Not now", action: { type: "close" } },
      },
      {
        kind: "button",
        key: "edit:6",
        label: "Log",
        value: { text: "Like", action: { type: "track", event: "liked" } },
      },
    ]);
  });

  it("offers an element wired by custom JavaScript as text only", () => {
    const html = page(
      `<button id="go" data-grovs-edit="Allow">Turn on</button>
       <script>document.getElementById("go").onclick = () => grovs.requestPushPermission();</script>`
    );
    expect(only(html)).toEqual({
      kind: "text",
      key: "edit:0",
      label: "Allow",
      value: "Turn on",
    });
  });

  it("skips text that holds other elements, and keeps a formatted button's action", () => {
    const html = page(
      `<p data-grovs-edit="Body">Hi <strong>there</strong></p>
       <button data-grovs-edit="Go" data-grovs-action="close"><svg width="1" height="1"></svg> Done</button>`
    );
    expect(fieldsOf(html)).toEqual([
      {
        kind: "button",
        key: "edit:1",
        label: "Go",
        value: { text: null, action: { type: "close" } },
      },
    ]);
  });

  it("finds nothing in a page without marks", () => {
    expect(fieldsOf(page("<p>Hi</p>"))).toEqual([]);
    expect(fieldsOf("")).toEqual([]);
  });
});

describe("applyField", () => {
  const edit = <F extends Field>(html: string, value: F["value"]) => {
    const field = only(html) as F;
    return applyField(html, field, value);
  };

  it("changes text, keeping the rest of the page", () => {
    const html = page('<h1 data-grovs-edit="Title">Old</h1><p>Rest</p>');
    const next = edit(html, "New & <better>");
    expect(next.startsWith("<!doctype html>\n<html")).toBe(true);
    const doc = parse(next);
    expect(doc.querySelector("h1")!.textContent).toBe("New & <better>");
    expect(doc.querySelector("p")!.textContent).toBe("Rest");
    expect(fieldsOf(next)[0]!.value).toBe("New & <better>");
  });

  it("changes an image and drops a srcset that would override it", () => {
    const html = page(
      '<img data-grovs-edit="Hero" src="https://a.example/1.png" srcset="https://a.example/2.png 2x" width="1" height="1" alt="">'
    );
    const img = parse(edit(html, "https://b.example/3.png")).querySelector(
      "img"
    )!;
    expect(img.getAttribute("src")).toBe("https://b.example/3.png");
    expect(img.hasAttribute("srcset")).toBe(false);
    expect(img.getAttribute("width")).toBe("1");
  });

  it("gives an image the new file's own size when it is known", () => {
    const html = page(
      '<img data-grovs-edit="Hero" src="https://a.example/1.png" width="1" height="1" alt="">'
    );
    const img = parse(
      applyField(html, only(html), "https://b.example/3.png", {
        width: 1200,
        height: 800,
      })
    ).querySelector("img")!;
    expect(img.getAttribute("width")).toBe("1200");
    expect(img.getAttribute("height")).toBe("800");
  });

  it("changes a video's own src or its first source", () => {
    const own = page(
      '<video data-grovs-edit="Clip" src="https://a.example/1.mp4" width="1" height="1"></video>'
    );
    expect(
      parse(edit(own, "https://b.example/2.mp4"))
        .querySelector("video")!
        .getAttribute("src")
    ).toBe("https://b.example/2.mp4");
    const sourced = page(
      '<video data-grovs-edit="Clip" width="1" height="1"><source src="https://a.example/1.mp4" type="video/mp4"></video>'
    );
    const doc = parse(edit(sourced, "https://b.example/2.mp4"));
    expect(doc.querySelector("source")!.getAttribute("src")).toBe(
      "https://b.example/2.mp4"
    );
    expect(doc.querySelector("video")!.hasAttribute("src")).toBe(false);
  });

  it("changes a button's label and each kind of action", () => {
    const html = page(
      '<button data-grovs-edit="CTA" data-grovs-action="close">Close</button>'
    );
    const button = (next: string) => parse(next).querySelector("button")!;

    const opened = edit(html, {
      text: "Shop",
      action: { type: "open", url: "https://shop.example" },
    });
    expect(button(opened).textContent).toBe("Shop");
    expect(button(opened).getAttribute("data-grovs-action")).toBe("open");
    expect(button(opened).getAttribute("data-grovs-url")).toBe(
      "https://shop.example"
    );

    const tracked = edit(opened, {
      text: "Like",
      action: { type: "track", event: "liked" },
    });
    expect(button(tracked).getAttribute("data-grovs-action")).toBe("track");
    expect(button(tracked).getAttribute("data-grovs-event")).toBe("liked");
    expect(button(tracked).hasAttribute("data-grovs-url")).toBe(false);

    const closed = edit(tracked, { text: "Bye", action: { type: "close" } });
    expect(button(closed).getAttribute("data-grovs-action")).toBe("close");
    expect(button(closed).hasAttribute("data-grovs-event")).toBe(false);
    expect(button(closed).textContent).toBe("Bye");
  });

  it("keeps a formatted button's content when only its action changes", () => {
    const html = page(
      '<button data-grovs-edit="Go" data-grovs-action="close"><b>Done</b></button>'
    );
    const next = edit(html, {
      text: null,
      action: { type: "track", event: "done" },
    });
    expect(parse(next).querySelector("button b")!.textContent).toBe("Done");
  });

  it("changes a colour in the element's inline style only", () => {
    const html = page(
      '<main data-grovs-edit-color="--brand" style="padding: 4px; --brand: #111111">x</main>'
    );
    const main = parse(edit(html, "#2A86FF")).querySelector("main")!;
    expect(main.style.getPropertyValue("--brand").trim()).toBe("#2A86FF");
    expect(main.style.getPropertyValue("padding")).toBe("4px");
  });

  it("keeps an attribute holding a field with a default", () => {
    const html = page(
      `<p data-grovs-edit="Body" title='{{ user.x | default: "x" }}' data-name='Hi {{ user.x | default: "x" }}'>Hi</p>`
    );
    const p = parse(edit(html, "Hello")).querySelector("p")!;
    expect(p.getAttribute("title")).toBe('{{ user.x | default: "x" }}');
    expect(p.getAttribute("data-name")).toBe('Hi {{ user.x | default: "x" }}');
  });

  it("leaves scripts and styles alone, adds no xmlns and keeps standards mode", () => {
    const script = "if (1 < 2 && true) { document.title = '<b>'; }";
    const style = "p > span { color: red; }";
    const html = page(
      '<p data-grovs-edit="Body">Old</p>',
      `<style>${style}</style><script>${script}</script>`
    );
    const next = edit(html, "New");
    expect(next).toContain(`<script>${script}</script>`);
    expect(next).toContain(`<style>${style}</style>`);
    expect(next).not.toContain("xmlns");
    expect(next.startsWith("<!doctype html>")).toBe(true);
    expect(parse(next).compatMode).toBe("CSS1Compat");
  });

  it("keeps comments around the page and standards mode", () => {
    const html = `<!-- made by acme -->\n<!doctype html>\n<!-- between -->\n<html><head></head><body><p data-grovs-edit="Body">Old</p></body></html>\n<!-- after -->\n`;
    const next = edit(html, "New");
    expect(next).toContain("<!-- made by acme -->");
    expect(next).toContain("<!-- between -->");
    expect(next).toContain("<!-- after -->");
    expect(next.indexOf("<!doctype html>")).toBeLessThan(next.indexOf("<html"));
    const doc = parse(next);
    expect(doc.compatMode).toBe("CSS1Compat");
    expect(doc.querySelector("p")!.textContent).toBe("New");
  });

  it("changes only the colour in the style text, keeping what the CSSOM can't read", () => {
    const html = page(
      '<main data-grovs-edit-color="--brand --accent" style="-webkit-tap-highlight-color: transparent; zoom: 1; --brand: #111111; foo-unknown: 3">x</main>'
    );
    const [brand, accent] = fieldsOf(html);
    expect(brand!.value).toBe("#111111");
    expect(accent!.value).toBe("");
    const once = applyField(html, brand!, "#2A86FF");
    const style = (next: string) =>
      parse(next).querySelector("main")!.getAttribute("style");
    expect(style(once)).toBe(
      "-webkit-tap-highlight-color: transparent; zoom: 1; --brand: #2A86FF; foo-unknown: 3"
    );
    expect(style(applyField(once, accent!, "#F59E0B"))).toBe(
      "-webkit-tap-highlight-color: transparent; zoom: 1; --brand: #2A86FF; foo-unknown: 3; --accent: #F59E0B"
    );
  });

  it("returns the html unchanged when the field is no longer there", () => {
    const html = page('<p data-grovs-edit="Body">Old</p>');
    const field = only(html);
    const other = page('<p data-grovs-edit="Other">Old</p>');
    expect(applyField(other, field, "New")).toBe(other);
  });
});
