#!/usr/bin/env python3
"""
websnap_capture.py - Playwright-based web capture with realistic browser headers.

Replaces shot-scraper for websnap, setting HTTP-layer headers that anti-bot
systems (Akamai, Cloudflare, etc.) expect from a real browser.
"""

import argparse
import json
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


def main():
    parser = argparse.ArgumentParser(description="Capture web pages with realistic headers")
    parser.add_argument("url", help="URL to capture")
    parser.add_argument("--width", type=int, default=1280)
    parser.add_argument("--height", type=int, default=None)
    parser.add_argument("--output", help="Output file path")
    parser.add_argument("--javascript", help="JavaScript to execute before capture")
    parser.add_argument("--run-js", help="Run JavaScript and output result (no screenshot)")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT)
    parser.add_argument("--reduced-motion", action="store_true")
    parser.add_argument("--full-page", action="store_true")

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
