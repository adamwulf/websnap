# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

websnap is a bash script wrapper around `shot-scraper` for taking screenshots of web pages. It outputs only the screenshot path to stdout, making it easy to pipe into other commands.

## Dependencies

- `shot-scraper` - Python tool for taking screenshots (install via `pipx install shot-scraper`)

## Usage

```bash
websnap <url> [options]
websnap http://example.com | xargs open  # take screenshot and open it
```

## Architecture

Single bash script (`websnap`) that:
1. Parses command-line arguments for URL, dimensions, and scroll offsets
2. Generates output filename from URL (saved to `/tmp/`)
3. Calls `shot-scraper` with appropriate flags
4. When scroll offsets are provided, injects JavaScript to scroll before capture (adds 1s delay)
5. Outputs only the file path to stdout for piping
