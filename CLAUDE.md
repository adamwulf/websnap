# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

websnap is a bash script wrapper around `shot-scraper` for taking screenshots of web pages or executing JavaScript against them. It outputs only the screenshot path (or JS result) to stdout, making it easy to pipe into other commands.

Each invocation spawns a fresh browser instance—no state (cookies, localStorage, sessions) persists between calls.

## Dependencies

- `shot-scraper` - Python tool for taking screenshots (install via `pipx install shot-scraper`)

## Usage

```bash
websnap <url> [options]
websnap http://example.com | xargs open  # take screenshot and open it
websnap http://example.com -f            # full page screenshot
websnap http://example.com -r 'document.title'  # run JS, output result
```

## Architecture

Single bash script (`websnap`) that:
1. Parses command-line arguments for URL, dimensions, scroll offsets, and mode flags
2. If `-r` flag: runs `shot-scraper javascript` and outputs the result directly
3. Otherwise: generates output filename from URL (saved to `/tmp/`)
4. Calls `shot-scraper` with appropriate flags (omits height for `-f` full page mode)
5. When scroll offsets are provided, injects JavaScript to scroll before capture (adds 1s delay)
6. Outputs only the file path to stdout for piping
