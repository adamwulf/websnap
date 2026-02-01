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
| `--help` | Show help message |

### Examples

```bash
# Basic screenshot
websnap http://localhost:1313/guide/

# Custom dimensions
websnap http://localhost:1313/guide/ -w 1920 -h 1080

# With scroll offset
websnap http://localhost:1313/guide/ --width 1280 --height 800 -y 800

# Take screenshot and open it
websnap http://example.com | xargs open
```

## Output

Screenshots are saved to `/tmp/{filename}.png` where the filename is derived from the URL. Only the file path is printed to stdout, making it easy to pipe into other commands.
