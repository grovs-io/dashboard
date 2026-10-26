const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B1220" media="(prefers-color-scheme: dark)">
<title>Message</title>
<style>
  :root {
    color-scheme: light dark;
    --bg: #FFFFFF;
    --text: #0F172A;
    --muted: #475569;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0B1220; --text: #F1F5F9; --muted: #94A3B8; }
  }
  * { box-sizing: border-box; }
  /* The app sizes a card or banner to its content: never give html or body a screen's height. */
  html, body { margin: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    -webkit-text-size-adjust: 100%;
  }
  /* viewport-fit=cover draws under a phone's notch and home bar: keep what people read and tap inside the safe area. */
  main { padding: calc(28px + env(safe-area-inset-top)) calc(24px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(24px + env(safe-area-inset-left)); }
  h1 { margin: 0 0 6px; padding-right: 32px; font-size: 22px; line-height: 1.25; }
  p { margin: 0; color: var(--muted); }
  .btn {
    appearance: none;
    width: 100%;
    min-height: 48px;
    margin-top: 20px;
    padding: 12px 20px;
    border: 0;
    border-radius: 14px;
    background: var(--brand);
    color: #FFFFFF;
    font: inherit;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }
  :focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
</style>
</head>
<body data-grovs-edit-color="--brand" style="--brand: #1D6FE0">
  <!-- The app draws the close button. data-grovs-action="close", "open" or "track" wires a tap without JavaScript. -->
  <main>
    <h1 data-grovs-edit="Headline">Hello {{ user.first_name | default: "there" }}</h1>
    <p data-grovs-edit="Text">Write your message here.</p>
    <button type="button" class="btn" data-grovs-edit="Button" data-grovs-action="close">Got it</button>
  </main>
</body>
</html>
`;
export default html;
