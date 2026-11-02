# websnap

A simple command-line tool for taking screenshots of web pages.

## Installation

1. Install the dependency:
   ```bash
   pipx install shot-scraper
   shot-scraper install  # installs Chromium
   ```

2. Add to your PATH:
   ```bash
   export PATH=$PATH:/path/to/snapweb/
   ```

## Usage

```bash
websnap <url|file> [options]
```

The input is a URL or a path to a local HTML file. All options work the same for both.

### Options

| Option | Description |
|--------|-------------|
| `-w, --width <px>` | Viewport width (default: 1280) |
| `-h, --height <px>` | Viewport height (default: 1080) |
| `-x, --xoffset <px>` | Horizontal scroll offset (png only) |
| `-y, --yoffset <px>` | Vertical scroll offset (png only) |
| `-f, --full` | Capture full page height (ignores -h; png only) |
| `-r, --run <js>` | Run JavaScript and output result (no screenshot) |
| `--format <fmt>` | Output format: `png` (screenshot) or `md` (Markdown). Default: `png` |
| `--no-js` | Disable the page's JavaScript (capture the server-rendered HTML) |
| `--base-url <url>` | Load a local file as if served from this `http(s)` URL (file input only) |
| `--help` | Show help message |

### Examples

```bash
# Basic screenshot
websnap http://localhost:1313/guide/

# Custom dimensions
websnap http://localhost:1313/guide/ -w 1920 -h 1080

# With scroll offset
websnap http://localhost:1313/guide/ --width 1280 --height 800 -y 800

# Full page screenshot
websnap http://example.com -f

# Run JavaScript and get result
websnap http://example.com -r 'document.title'

# Extract the page as Markdown
websnap http://example.com --format md

# Extract Markdown from a JS-heavy / archived SPA page (capture the
# server-rendered HTML before the client scripts can rewrite it)
websnap "https://web.archive.org/web/.../https://medium.com/..." --format md --no-js

# Take screenshot and open it
websnap http://example.com | xargs open

# Extract Markdown and read it
websnap http://example.com --format md | xargs cat

# Load a local HTML file (relative URLs resolve against its folder)
websnap saved/page.html --format md
websnap saved/page.html -r 'document.title'

# Load a saved page as if it were still at its original URL
websnap saved/page.html --format md --base-url https://example.com/blog/post
```

### Local files

A path to an existing file is always parsed as HTML, whatever its extension. A `file://` URL also works, but the browser then decides how to treat it from the extension, and `--base-url` doesn't apply.

Relative URLs resolve against the file's folder, and the Markdown frontmatter's `url` is the file's `file://` path.

`--base-url` serves the file's HTML as the response to that URL, so the page behaves as if it came from there: `document.URL` and the frontmatter `url` are that URL, and relative images, CSS, and scripts load from that site over the network. Pass the page's own URL. Standard URL rules apply, so with `https://example.com/blog` (no trailing slash), `img.png` resolves to `https://example.com/img.png`. A `<base>` tag in the file still takes priority for resolving relative URLs.

A local file's scripts run by default and can make network requests. Use `--no-js` for HTML you don't trust, but note that `-r` ignores `--no-js`.

## Output

Screenshots are saved to `/tmp/{filename}.png` (or, with `--format md`, Markdown to `/tmp/{filename}.md`) where the filename is derived from the URL, or from the absolute path for a local file. Only the file path is printed to stdout, making it easy to pipe into other commands.

### Markdown format

`--format md` extracts the page's main content and converts it to GitHub-flavored Markdown. It uses [Mozilla Readability](https://github.com/mozilla/readability) (the Firefox Reader View extractor) plus [Turndown](https://github.com/mixmark-io/turndown) with the GFM plugin — the same libraries the `freezedry-webpage` extension uses, so article output matches that tool.

Pages that read like a prose article are extracted with Readability. Anything else — a dashboard, a list, an app screen — takes a full-page fallback: the whole rendered `<body>` is converted after dropping everything the browser does not actually paint (`display:none` from any stylesheet, not just `[hidden]`), plus scripts, styles, navigation landmarks, and interactive controls. The fallback never returns empty. Images keep their absolute remote URLs (they are not inlined).

Every `.md` file begins with a YAML frontmatter block:

```yaml
---
title: "Page Title"
url: "https://example.com/article"
date: 2026-08-24T21:17:02.975Z
author: "Jane Doe"
---
```

`date` is the fetch time (ISO 8601); `author` appears only when Readability finds a byline.

**`--no-js` and single-page apps.** By default the page's own JavaScript runs before extraction. Some pages (notably archived Medium/Substack snapshots and other client-rendered SPAs) are server-rendered *with* the article, but their client JS then rewrites the DOM — often into a "404" or an app shell — so the Markdown captures that instead of the article. Add `--no-js` to disable the page's scripts and extract the server-rendered HTML. Readability still runs (websnap injects it over a separate channel), so you get the real article. Use it only when a normal `--format md` comes back wrong; JS-rendered sites need their scripts to build the content in the first place.

## Known Limitations

- **Video codec support**: Headless Chromium (used by shot-scraper) has limited video codec support. Videos encoded with H.265/HEVC or other proprietary codecs won't load metadata, causing them to render at incorrect dimensions. H.264 videos generally work.

- **Lazy-loaded content**: When using scroll offsets, websnap attempts to disable lazy loading and preload images before scrolling. However, JS-based lazy loading may still cause layout differences compared to a fully-scrolled browser session.

## Claude Code Skill

This repo includes a Claude Code skill that enables the `/websnap` command. To install:

```bash
# Create the skills directory if it doesn't exist
mkdir -p ~/.claude/skills/websnap

# Copy the skill file
cp skills/SKILL.md ~/.claude/skills/websnap/SKILL.md
```

Once installed, you can use `/websnap <url>` in Claude Code to take screenshots and view them directly in your conversation.
