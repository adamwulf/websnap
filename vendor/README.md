# Vendored bundles

Third-party JavaScript that `websnap` injects into the rendered page when
producing Markdown (`--format md`). Committed as-is — websnap has no build step
and loads nothing from a CDN at runtime.

`websnap_capture.py` injects these three files after the page has rendered by
reading each and evaluating it over the debugger's evaluate channel
(`page.evaluate("(src) => { (0, eval)(src); }", source)`), then runs
`websnap_markdown.js` against the globals they define (`Readability`,
`TurndownService`, `turndownPluginGfm`). Each file is a **classic script** whose
top-level declaration becomes a global under indirect `eval`. This channel is not
subject to the page's CSP and still runs when the page's own JavaScript is
disabled (`--no-js`) — a `<script>` tag would not.

| File | Package | Version | License | Source |
|---|---|---|---|---|
| `readability.js` | `@mozilla/readability` | 0.6.0 | Apache-2.0 | `unpkg.com/@mozilla/readability@0.6.0/Readability.js` |
| `turndown.js` | `turndown` | 7.2.4 | MIT | `unpkg.com/turndown@7.2.4/dist/turndown.js` |
| `turndown-plugin-gfm.js` | `turndown-plugin-gfm` | 1.0.2 | MIT | `unpkg.com/turndown-plugin-gfm@1.0.2/dist/turndown-plugin-gfm.js` |

These are the same files (same versions, downloaded verbatim from unpkg) used by
the `freezedry-webpage` Chrome extension's Markdown export, so websnap's Markdown
matches that extension's output for the article path. (websnap keeps images as
absolute remote URLs instead of inlining them, so image-heavy pages differ.)

Note: `readability.js` does **not** ship `isProbablyReaderable`; that reader-mode
gate is ported into `websnap_markdown.js` directly.

**If you upgrade them**, keep the same download sources, update the version table
above, and re-check that each file still defines its global when run as a classic
script (Readability's file, for instance, is a bare `function Readability(...)`
plus a CommonJS guard that stays inert in the browser).
