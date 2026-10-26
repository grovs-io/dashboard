import { describe, expect, it, vi } from "vitest";
import {
  HTML_FIELD,
  HTML_MAX_BYTES,
  htmlBytes,
  htmlLayout,
  htmlProblems,
  htmlWarnings,
  mediaProblem,
  mediaTag,
  mediaUsed,
} from "../inAppHtml";

vi.mock("@/lib/config", () => ({
  config: { apiUrl: "http://localhost:3000" },
}));

const page = (body: string) =>
  `<!doctype html><html><body>${body}</body></html>`;

describe("htmlBytes", () => {
  it("counts raw UTF-8 bytes, not characters", () => {
    expect(htmlBytes("abc")).toBe(3);
    expect(htmlBytes("é")).toBe(2);
    expect(htmlBytes("😀")).toBe(4);
  });
});

describe("htmlProblems", () => {
  it("passes a clean page", () => {
    expect(
      htmlProblems(
        page(
          '<a href="https://acme.example">Go</a><a href="#top">Top</a><img src="https://cdn.example/a.png" width="10" height="10">'
        )
      )
    ).toEqual([]);
  });

  it("refuses an empty page", () => {
    expect(htmlProblems("  \n")).toEqual(["The HTML cannot be empty."]);
  });

  it("measures the size in raw bytes", () => {
    const under = "é".repeat(HTML_MAX_BYTES / 2);
    expect(htmlProblems(under)).toEqual([]);
    expect(htmlProblems(`${under}a`)).toEqual([
      "The HTML is larger than 64 KB.",
    ]);
  });

  it("refuses a base tag and a refresh", () => {
    expect(htmlProblems('<base href="https://x.example/">hi')).toContain(
      "The HTML cannot use a <base> tag."
    );
    expect(
      htmlProblems(
        '<meta http-equiv="Refresh" content="0;url=https://x.example">'
      )
    ).toContain('The HTML cannot use <meta http-equiv="refresh">.');
  });

  it("looks inside template contents, nested too", () => {
    expect(
      htmlProblems(
        page(
          '<template><template><a href="javascript:x">x</a></template></template>'
        )
      )
    ).toEqual(["The HTML links to an address that is not allowed."]);
    expect(
      htmlProblems(
        page('<template><base href="https://x.example/"></template>')
      )
    ).toContain("The HTML cannot use a <base> tag.");
  });

  it("checks links with the shared rule", () => {
    const bad = "The HTML links to an address that is not allowed.";
    expect(htmlProblems(page('<a href="javascript:alert(1)">x</a>'))).toEqual([
      bad,
    ]);
    expect(htmlProblems(page('<a href="/relative">x</a>'))).toEqual([bad]);
    expect(
      htmlProblems(
        page(
          '<button data-grovs-action="open" data-grovs-url="http://x.example">x</button>'
        )
      )
    ).toEqual([bad]);
    expect(htmlProblems(page('<a href="myapp://open">x</a>'))).toEqual([]);
  });

  it("checks resources", () => {
    const bad = "The HTML loads a resource that is not allowed.";
    expect(
      htmlProblems(
        page(
          '<video src="http://x.example/a.mp4" width="1" height="1"></video>'
        )
      )
    ).toEqual([bad]);
    expect(
      htmlProblems(
        page(
          '<video poster="http://x.example/a.png" width="1" height="1"></video>'
        )
      )
    ).toEqual([bad]);
    expect(
      htmlProblems(
        page('<div style="background: URL(http://x.example/a.png)"></div>')
      )
    ).toEqual([bad]);
    expect(
      htmlProblems('<link rel="stylesheet" href="http://x.example/a.css">x')
    ).toEqual([bad]);
    expect(
      htmlProblems(
        page(
          '<img srcset="data:image/png;base64,AA,BB 1x, https://x.example/b.png 2x" width="1" height="1">'
        )
      )
    ).toEqual([]);
    expect(
      htmlProblems(
        page(
          '<img srcset="https://x.example/a.png 1x, http://x.example/b.png 2x" width="1" height="1">'
        )
      )
    ).toEqual([bad]);
    expect(
      htmlProblems(
        page('<img src="data:image/png;base64,AA" width="1" height="1">')
      )
    ).toEqual([]);
  });

  it("names a field inside a URL attribute, the first three only", () => {
    const problems = htmlProblems(
      page(
        ["a", "b", "c", "d"]
          .map((k) => `<a href="https://x.example/?u={{ user.${k} }}">x</a>`)
          .join("")
      )
    );
    expect(problems).toEqual([
      'The HTML holds {{ inside a URL attribute: href="https://x.example/?u={{ user.a }}", href="https://x.example/?u={{ user.b }}", href="https://x.example/?u={{ user.c }}"; build personalized URLs with grovs.user.',
    ]);
  });

  it("hands out a list of its own, though it remembers the answer", () => {
    const first = htmlProblems(" ");
    first.push("mine");
    expect(htmlProblems(" ")).toEqual(["The HTML cannot be empty."]);
  });

  it("splits srcset only at the server's whitespace", () => {
    expect(
      htmlProblems(
        page(
          '<img srcset="https://x.example/a.png\u00a0http://x.example/b.png 1x" width="1" height="1">'
        )
      )
    ).toEqual([]);
  });

  it("allows fields and braces elsewhere", () => {
    expect(
      htmlProblems(
        page(
          '<p title="{{ user.name }}">Hi {{ user.name | default: "there" }}</p><script>if (a) { b({{}}) }</script>'
        )
      )
    ).toEqual([]);
  });
});

describe("htmlWarnings", () => {
  it("counts unsized images and videos", () => {
    expect(
      htmlWarnings(
        page(
          '<img src="https://x.example/a.png"><video src="https://x.example/a.mp4" width="10"></video><img src="https://x.example/b.png" width="1" height="1"><img src="https://x.example/c.png" style="aspect-ratio: 1 / 1">'
        )
      )
    ).toEqual([
      "The HTML has 2 unsized images or videos that may make the message jump.",
    ]);
    expect(htmlWarnings(page('<img src="https://x.example/a.png">'))).toEqual([
      "The HTML has 1 unsized image or video that may make the message jump.",
    ]);
    expect(htmlWarnings(page("<p>hi</p>"))).toEqual([]);
  });

  it("counts a width or height of only spaces as missing", () => {
    expect(
      htmlWarnings(
        page('<img src="https://x.example/a.png" width=" " height="10">')
      )
    ).toHaveLength(1);
  });
});

describe("media", () => {
  const sized = (type: string, bytes: number) => {
    const f = new File([], "a", { type });
    Object.defineProperty(f, "size", { value: bytes });
    return f;
  };
  const MB = 1024 * 1024;

  it("takes each kind up to its size", () => {
    expect(mediaProblem(sized("image/png", MB), [])).toBeNull();
    expect(mediaProblem(sized("image/gif", MB + 1), [])).toBe(
      "An image must be under 1 MB."
    );
    expect(mediaProblem(sized("video/mp4", 20 * MB), [])).toBeNull();
    expect(mediaProblem(sized("video/mp4", 20 * MB + 1), [])).toBe(
      "A video must be under 20 MB."
    );
    expect(mediaProblem(sized("audio/mpeg", 10 * MB + 1), [])).toBe(
      "An audio file must be under 10 MB."
    );
    expect(mediaProblem(sized("audio/x-m4a", 10), [])).toBeNull();
    expect(mediaProblem(sized("video/webm", 10), [])).toBe(
      "Upload a PNG, JPEG or GIF image, an MP4 video, or an MP3 or M4A audio file."
    );
  });

  it("keeps a campaign within 30 files and 100 MB", () => {
    const item = (bytes: number) => ({
      id: "m",
      url: "https://x.example/m",
      type: "video/mp4",
      bytes,
      used: false,
    });
    expect(
      mediaProblem(
        sized("image/png", 10),
        Array.from({ length: 30 }, () => item(1))
      )
    ).toBe("A message holds at most 30 files. Delete an unused one first.");
    expect(
      mediaProblem(
        sized("video/mp4", 2 * MB),
        Array.from({ length: 5 }, () => item(20 * MB))
      )
    ).toBe(
      "A message holds at most 100 MB of files. Delete an unused one first."
    );
  });

  it("finds a file in any variant's HTML", () => {
    expect(
      mediaUsed(
        ["<p></p>", '<img src="https://x.example/m">'],
        "https://x.example/m"
      )
    ).toBe(true);
    expect(mediaUsed(["<p></p>"], "https://x.example/m")).toBe(false);
  });
});

describe("HTML_FIELD", () => {
  // A copy of `var FIELD` in the backend's ee/config/in_app/bridge.js; change both together.
  it("is bridge.js's own field pattern", () => {
    expect(String(HTML_FIELD)).toBe(
      String.raw`/\{\{\s*(user|event)\.([A-Za-z0-9_]+)\s*(?:\|\s*default:\s*"([^"]*)"\s*)?\}\}/g`
    );
  });
});

describe("mediaTag", () => {
  const url = "https://cdn.example/media/hero.png";

  it("sizes an image by its own pixels, or 600 by 400 when unknown", () => {
    expect(mediaTag("image", url, { width: 1200, height: 800 })).toBe(
      `<img src="${url}" alt="" width="1200" height="800" style="max-width:100%;height:auto">`
    );
    expect(mediaTag("image", url)).toBe(
      `<img src="${url}" alt="" width="600" height="400" style="max-width:100%;height:auto">`
    );
  });

  it("plays a video inline and muted, and gives audio its controls", () => {
    expect(mediaTag("video", "https://cdn.example/a.mp4")).toBe(
      '<video src="https://cdn.example/a.mp4" width="640" height="360" style="width:100%;height:auto" playsinline muted loop autoplay controls></video>'
    );
    expect(mediaTag("audio", "https://cdn.example/a.mp3")).toBe(
      '<audio src="https://cdn.example/a.mp3" controls></audio>'
    );
  });

  it("leaves the HTML with no problems and no warnings", () => {
    for (const tag of [
      mediaTag("image", url),
      mediaTag("video", "https://cdn.example/a.mp4"),
      mediaTag("audio", "https://cdn.example/a.mp3"),
    ]) {
      expect(htmlProblems(page(tag))).toEqual([]);
      expect(htmlWarnings(page(tag))).toEqual([]);
    }
  });

  it("cannot break out of the attribute", () => {
    expect(mediaTag("audio", 'https://x.example/a"b.mp3')).toBe(
      '<audio src="https://x.example/a%22b.mp3" controls></audio>'
    );
  });
});

describe("local development media", () => {
  it("accepts files a local API serves over http", () => {
    expect(
      htmlProblems(
        page(
          '<img src="http://localhost:3000/x.png" alt="" width="1" height="1"><video src="http://api.lvh.me:3000/a.mp4" width="1" height="1"></video>'
        )
      )
    ).toEqual([]);
    expect(
      htmlProblems(
        page('<img src="http://localhost.evil.com/a.png" width="1" height="1">')
      )
    ).toHaveLength(1);
  });
});

describe("htmlLayout", () => {
  const head = (meta: string) =>
    `<!doctype html><html><head><meta charset="utf-8">${meta}</head><body><p>Hi</p></body></html>`;

  it("reads the layout a design is made for", () => {
    expect(htmlLayout(head('<meta name="grovs-layout" content="full">'))).toBe(
      "full"
    );
    expect(
      htmlLayout(head("<META content=' banner_bottom ' NAME='Grovs-Layout'>"))
    ).toBe("banner_bottom");
    expect(htmlLayout(head("<meta name=grovs-layout content=modal>"))).toBe(
      "modal"
    );
  });

  it("is null without the meta, with an unknown layout or outside the head", () => {
    expect(htmlLayout(head(""))).toBeNull();
    expect(htmlLayout("")).toBeNull();
    expect(
      htmlLayout(head('<meta name="grovs-layout" content="sidebar">'))
    ).toBeNull();
    expect(
      htmlLayout(head('<meta data-name="grovs-layout" content="full">'))
    ).toBeNull();
    expect(
      htmlLayout(page('<meta name="grovs-layout" content="full">'))
    ).toBeNull();
  });
});
