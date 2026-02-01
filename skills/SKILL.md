---
name: websnap
description: Take a screenshot of a web page or run JavaScript against it. Use when checking page layout, verifying styling changes, inspecting rendered content, or querying page properties like dimensions.
argument-hint: <url> [-w width] [-h height] [-y scroll] [-f] [-r js]
allowed-tools: Bash, Read
disable-model-invocation: true
---

Take a screenshot of the specified URL using `websnap` and display the result.

## Steps

1. Run: `websnap $ARGUMENTS`
2. For screenshots: the command outputs the path to the saved PNG (in `/tmp/`), then use the Read tool to display the image
3. For `-r` (run JS): the command outputs the JavaScript result directly (no screenshot)

## Options

- `-w, --width <px>` — Viewport width (default: 1280)
- `-h, --height <px>` — Viewport height (default: 1080)
- `-x, --xoffset <px>` — Horizontal scroll offset
- `-y, --yoffset <px>` — Vertical scroll offset
- `-f, --full` — Capture full page height (ignores -h)
- `-r, --run <js>` — Run JavaScript and output result (no screenshot)

## Examples

```
/websnap http://localhost:1313/guide/
/websnap http://localhost:1313/ -w 1920 -h 1080
/websnap http://localhost:1313/guide/ -y 500
/websnap http://localhost:1313/ -f
/websnap http://example.com -r 'document.title'
/websnap http://example.com -r 'document.documentElement.scrollHeight'
```

If no URL is provided, ask the user what page they want to screenshot.

## Notes

Each call to `websnap` spawns a fresh browser instance. State does not persist between calls (no cookies, localStorage, or session data).
