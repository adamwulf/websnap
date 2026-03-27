# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

websnap is a bash script that uses Playwright (via `websnap_capture.py`) for taking screenshots of web pages or executing JavaScript against them. It outputs only the screenshot path (or JS result) to stdout, making it easy to pipe into other commands.

Each invocation spawns a fresh browser instance—no state (cookies, localStorage, sessions) persists between calls.

## Dependencies

- `shot-scraper` - Python tool (install via `pipx install shot-scraper`). websnap uses shot-scraper's bundled Playwright and Python venv rather than calling shot-scraper directly.

## Usage

```bash
websnap <url> [options]
websnap http://example.com | xargs open  # take screenshot and open it
websnap http://example.com -f            # full page screenshot
websnap http://example.com -r 'document.title'  # run JS, output result
```

## Architecture

Two files:
- `websnap` (bash) — CLI interface, argument parsing, orchestration
- `websnap_capture.py` (Python) — Playwright-based capture with realistic HTTP headers

Flow:
1. `websnap` parses command-line arguments for URL, dimensions, scroll offsets, and mode flags
2. Discovers the Python interpreter from shot-scraper's pipx venv (which has Playwright installed)
3. If `-r` flag: runs `websnap_capture.py --run-js` and outputs the result directly
4. Otherwise: generates output filename from URL (saved to `/tmp/`)
5. Calls `websnap_capture.py` with appropriate flags (omits height for `-f` full page mode)
6. When scroll offsets are provided, injects JavaScript to scroll before capture (adds 1s delay)
7. `websnap_capture.py` sets realistic HTTP-layer headers (Accept, Accept-Language, Sec-Fetch-*, sec-ch-ua, etc.) via Playwright's `extra_http_headers` to bypass anti-bot systems like Akamai
8. Outputs only the file path to stdout for piping

## Known Limitations

- **Video codec support**: Headless Chromium (used by shot-scraper) has limited video codec support. Videos encoded with H.265/HEVC or other proprietary codecs won't load metadata, causing them to render at incorrect dimensions. H.264 videos generally work. This is a Chromium limitation, not a websnap issue.

- **Lazy-loaded content**: When using scroll offsets, websnap attempts to disable lazy loading and preload images before scrolling. However, JS-based lazy loading may still cause layout differences compared to a fully-scrolled browser session.

- **Bot detection (Akamai, Cloudflare, etc.)**: websnap sets realistic HTTP-layer headers (Accept, Accept-Language, Sec-Fetch-*, sec-ch-ua) to bypass most anti-bot checks. Sites with advanced behavioral analysis (mouse movement, JS challenges) may still detect automation. The `-u` flag allows overriding the user-agent if needed.
