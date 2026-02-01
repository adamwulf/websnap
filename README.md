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
websnap <url> [options]
```

### Options

| Option | Description |
|--------|-------------|
| `-w, --width <px>` | Viewport width (default: 1280) |
| `-h, --height <px>` | Viewport height (default: 1080) |
| `-x, --xoffset <px>` | Horizontal scroll offset |
| `-y, --yoffset <px>` | Vertical scroll offset |
| `-f, --full` | Capture full page height (ignores -h) |
| `-r, --run <js>` | Run JavaScript and output result (no screenshot) |
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

# Take screenshot and open it
websnap http://example.com | xargs open
```

## Output

Screenshots are saved to `/tmp/{filename}.png` where the filename is derived from the URL. Only the file path is printed to stdout, making it easy to pipe into other commands.

## Claude Code Skill

This repo includes a Claude Code skill that enables the `/websnap` command. To install:

```bash
# Create the skills directory if it doesn't exist
mkdir -p ~/.claude/skills/websnap

# Copy the skill file
cp skills/SKILL.md ~/.claude/skills/websnap/SKILL.md
```

Once installed, you can use `/websnap <url>` in Claude Code to take screenshots and view them directly in your conversation.
