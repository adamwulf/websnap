# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

websnap is a bash script that uses Playwright (via `websnap_capture.py`) for taking screenshots of web pages, extracting them as Markdown, or executing JavaScript against them. It outputs only the screenshot/Markdown path (or JS result) to stdout, making it easy to pipe into other commands.

Each invocation spawns a fresh browser instance—no state (cookies, localStorage, sessions) persists between calls.

## Dependencies

- `shot-scraper` - Python tool (install via `pipx install shot-scraper`). websnap uses shot-scraper's bundled Playwright and Python venv rather than calling shot-scraper directly.

## Usage

```bash
websnap <url|file> [options]
websnap http://example.com | xargs open  # take screenshot and open it
websnap http://example.com -f            # full page screenshot
websnap http://example.com -r 'document.title'  # run JS, output result
websnap page.html --format md            # local HTML file
websnap page.html --format md --base-url https://example.com/blog/post
```

## Architecture

Files:
- `websnap` (bash) — CLI interface, argument parsing, orchestration
- `websnap_capture.py` (Python) — Playwright-based capture with realistic HTTP headers
- `websnap_markdown.js` — in-page Markdown extraction pipeline (used by `--format md`)
- `vendor/` — third-party libraries injected for Markdown extraction (Readability, Turndown, Turndown GFM plugin); see `vendor/README.md` for versions/provenance

Flow:
1. `websnap` parses command-line arguments for URL, dimensions, scroll offsets, output format, and mode flags
2. Discovers the Python interpreter from shot-scraper's pipx venv (which has Playwright installed)
3. If `-r` flag: runs `websnap_capture.py --run-js` and outputs the result directly
4. If `--format md`: runs `websnap_capture.py --markdown` (saves `/tmp/{filename}.md`) and outputs that path
5. Otherwise (png): generates output filename from URL (saved to `/tmp/`)
6. Calls `websnap_capture.py` with appropriate flags (omits height for `-f` full page mode)
7. When scroll offsets are provided, injects JavaScript to scroll before capture (adds 1s delay)
8. `websnap_capture.py` sets realistic HTTP-layer headers (Accept, Accept-Language, Sec-Fetch-*, sec-ch-ua, etc.) via Playwright's `extra_http_headers` to bypass anti-bot systems like Akamai
9. Outputs only the file path to stdout for piping

### Markdown extraction (`--format md`)

After the page renders, `websnap_capture.py` reads the three `vendor/` libraries plus `websnap_markdown.js` and injects each over the debugger's evaluate channel — `page.evaluate("(src) => { (0, eval)(src); }", source)` — rather than as `<script>` tags. This matters for two reasons: it is not subject to the page's CSP, and it still runs when the page's own JavaScript is disabled (`--no-js`), which `add_script_tag` would not. It then calls `window.__websnapExtractMarkdown()` via `page.evaluate` and writes the returned string to the `.md` file. The pipeline is a port of the `freezedry-webpage` extension's `export-markdown.js`, so article output matches that tool:
- Output starts with a YAML frontmatter block (`title`, `url`, `date` = fetch time, and `author` when Readability found a byline). Strings are double-quoted and escaped so a `:`/`"`/newline can't break the block.
- `isProbablyReaderable` gate decides article vs. full-page path (keeps Readability away from list/dashboard pages it would mangle).
- Article path: `Readability` on a document clone; if the extracted text is under `MIN_ARTICLE_CHARS` (500) the pick counts as blank and falls through.
- Full-page fallback: clone the `<body>`, drop every element the browser does not actually paint (`getClientRects()`/computed style — `display:none` from any stylesheet, not just `[hidden]`), then strip scripts/styles, `<nav>`/`role=navigation`, and interactive controls, and absolutize URLs. Never returns empty.
- Both paths convert with Turndown (atx headings, fenced code, `hr: ---`, `bulletListMarker: -`) + the GFM plugin.
- Unlike the extension, images are **not** inlined — they keep absolute remote URLs (websnap is text-first).

### `--no-js`

Sets Playwright's `java_script_enabled=False` on the context, so the page's own scripts never run and a client-side SPA can't rewrite the server-rendered HTML before capture. Works for both formats. It's essential for archived SPA snapshots (e.g. a Wayback `id_/` Medium URL): the raw HTML is server-rendered with the article, but Medium's client JS otherwise hydrates the DOM into its own 404. Because the Markdown libraries are injected over the evaluate channel (above), Readability still runs under `--no-js`. Do not use it on genuinely client-rendered sites — they need their scripts to build the content at all.

### Local file input and `--base-url`

The input is a local file if one exists at that path (`websnap` checks this first, so `foo:bar.html` is a file); otherwise it must have a URL scheme or `websnap` exits with an error. `--base-url` must be `http(s)` and is rejected for URL input, including `file://` URLs.

`websnap_capture.py` serves a local file with a one-shot `page.route(..., times=1)` + `route.fulfill` as the response to `page.goto` — to `--base-url` if given, otherwise to the file's own `file://` URL. The later requests go out as usual, so relative assets load from the file's folder or from the base URL's site. This is why the behavior is the same for both:
- It parses as HTML whatever the extension. A plain `file://` load of an extensionless file is not parsed as HTML, which would break temp files.
- `document.URL`, and so the frontmatter `url`, is the real location. A `<base>` tag injected into the document couldn't do this.
- The response declares `charset=utf-8` when the bytes are valid UTF-8 (`html_content_type`), because over `http(s)` Chromium reads undeclared text as windows-1252. Other bytes stay undeclared so the file's `<meta charset>` applies.

Output names come from the file's absolute path, not its basename, so two `index.html` files in different folders don't overwrite each other.

### Proxy env vars

Chromium ignores `http_proxy`/`https_proxy`, so `websnap_capture.py` passes them to `p.chromium.launch(proxy=...)` explicitly: the server is the first non-empty of `https_proxy`, `HTTPS_PROXY`, `http_proxy`, `HTTP_PROXY`, and `no_proxy`/`NO_PROXY` becomes the bypass list. This is what lets websnap work inside a sandbox that only allows localhost and exports a local filtering proxy (e.g. itsybitsy's); without it every page fails with `net::ERR_ACCESS_DENIED`. With no proxy var set, Chromium launches with no `proxy` option, as before.

## Known Limitations

- **Video codec support**: Headless Chromium (used by shot-scraper) has limited video codec support. Videos encoded with H.265/HEVC or other proprietary codecs won't load metadata, causing them to render at incorrect dimensions. H.264 videos generally work. This is a Chromium limitation, not a websnap issue.

- **Lazy-loaded content**: When using scroll offsets, websnap attempts to disable lazy loading and preload images before scrolling. However, JS-based lazy loading may still cause layout differences compared to a fully-scrolled browser session.

- **Bot detection (Akamai, Cloudflare, etc.)**: websnap sets realistic HTTP-layer headers (Accept, Accept-Language, Sec-Fetch-*, sec-ch-ua) to bypass most anti-bot checks. Sites with advanced behavioral analysis (mouse movement, JS challenges) may still detect automation. The `-u` flag allows overriding the user-agent if needed.
