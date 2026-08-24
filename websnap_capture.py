#!/usr/bin/env python3
"""
websnap_capture.py - Playwright-based web capture with realistic browser headers.

Replaces shot-scraper for websnap, setting HTTP-layer headers that anti-bot
systems (Akamai, Cloudflare, etc.) expect from a real browser.
"""

import argparse
import json
import os
import sys

from playwright.sync_api import sync_playwright


# Headers that a real Chrome/Brave browser sends on every navigation request.
# These must be set at the HTTP layer (Playwright extra_http_headers), not JS.
DEFAULT_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Sec-GPC": "1",
    "Upgrade-Insecure-Requests": "1",
    "sec-ch-ua": '"Not:A-Brand";v="99", "Chromium";v="131"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
}

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# Directory holding this script, the vendor/ libraries, and websnap_markdown.js.
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Classic scripts injected (in order) into the rendered page for --markdown: the
# three vendored libraries define the Readability / TurndownService /
# turndownPluginGfm globals, then websnap_markdown.js defines
# window.__websnapExtractMarkdown() against them. See vendor/README.md.
MARKDOWN_SCRIPTS = [
    os.path.join(SCRIPT_DIR, "vendor", "readability.js"),
    os.path.join(SCRIPT_DIR, "vendor", "turndown.js"),
    os.path.join(SCRIPT_DIR, "vendor", "turndown-plugin-gfm.js"),
    os.path.join(SCRIPT_DIR, "websnap_markdown.js"),
]


def main():
    parser = argparse.ArgumentParser(description="Capture web pages with realistic headers")
    parser.add_argument("url", help="URL to capture")
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=None)
    parser.add_argument("--output", help="Output file path")
    parser.add_argument("--javascript", help="JavaScript to execute before capture")
    parser.add_argument("--run-js", help="Run JavaScript and output result (no screenshot)")
    parser.add_argument("--markdown", action="store_true",
                        help="Extract the page as Markdown instead of a screenshot")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT)
    parser.add_argument("--reduced-motion", action="store_true")
    parser.add_argument("--full-page", action="store_true")
    parser.add_argument("--no-js", action="store_true",
                        help="Disable the page's own JavaScript (capture the "
                             "server-rendered HTML before any client hydration)")

    args = parser.parse_args()

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
            ],
        )

        context_opts = {
            "user_agent": args.user_agent,
            "extra_http_headers": dict(DEFAULT_HEADERS),
            "viewport": {"width": args.width, "height": args.height or 1080},
        }
        if args.reduced_motion:
            context_opts["reduced_motion"] = "reduce"
        # --no-js disables the page's own scripts so a client-side SPA can't
        # rewrite the server-rendered HTML before we capture it. Markdown
        # extraction still works: its libraries are injected over the debugger's
        # evaluate channel (see below), which runs even with page JS disabled.
        if args.no_js:
            context_opts["java_script_enabled"] = False

        context = browser.new_context(**context_opts)
        page = context.new_page()

        # Navigate to the URL
        page.goto(args.url, wait_until="networkidle")

        # JS-only mode: run script and print result
        if args.run_js:
            result = page.evaluate(args.run_js)
            if result is not None:
                print(result)
            browser.close()
            return

        # Markdown mode: extract the rendered page as Markdown and write it out.
        # Runs after the page has rendered (goto waited for networkidle) so the
        # full-page fallback's getClientRects()/getComputedStyle checks see real
        # layout.
        if args.markdown:
            # Inject the vendored libraries + extractor over the debugger's
            # evaluate channel (indirect eval to define their globals) rather
            # than as <script> tags. This runs even when the page's own
            # JavaScript is disabled (--no-js) — add_script_tag scripts would
            # not — and is not subject to the page's CSP.
            for script_path in MARKDOWN_SCRIPTS:
                with open(script_path, "r", encoding="utf-8") as handle:
                    source = handle.read()
                page.evaluate("(src) => { (0, eval)(src); }", source)
            result = page.evaluate("() => window.__websnapExtractMarkdown()")
            browser.close()

            if not result or not result.get("ok"):
                error = (result or {}).get("error", "unknown error")
                print("Markdown extraction failed: " + error, file=sys.stderr)
                sys.exit(1)

            markdown = result["markdown"]
            if args.output:
                with open(args.output, "w", encoding="utf-8") as handle:
                    handle.write(markdown)
                print(args.output)
            else:
                sys.stdout.write(markdown)
            return

        # Execute pre-screenshot JavaScript if provided
        if args.javascript:
            page.evaluate(args.javascript)

        # Take screenshot
        screenshot_opts = {}
        if args.output:
            screenshot_opts["path"] = args.output
        if args.full_page:
            screenshot_opts["full_page"] = True

        page.screenshot(**screenshot_opts)

        if args.output:
            print(args.output)

        browser.close()


if __name__ == "__main__":
    main()
