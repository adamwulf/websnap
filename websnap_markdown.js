// websnap_markdown.js — Markdown extraction, runs in the rendered page context.
//
// Injected by websnap_capture.py AFTER the vendored readability.js, turndown.js,
// and turndown-plugin-gfm.js classic scripts (all injected into the same page),
// so this file can assume the Readability / TurndownService / turndownPluginGfm
// globals exist. It defines ONE global, window.__websnapExtractMarkdown(), which
// websnap_capture.py invokes with page.evaluate; the object it returns carries the
// Markdown string, and Python writes it to the .md file.
//
// Ported from the freezedry-webpage extension's export-markdown.js — the same
// isProbablyReaderable gate, Readability extraction, min-char fallback, and
// Turndown settings, so the article-path output matches that extension. The
// image-inlining and in-page-download machinery is dropped: websnap is a
// text-first CLI, so images keep their absolutized remote URLs and Python owns
// the file write.
//
// UPSTREAM: this file (and the vendored libraries under vendor/) are copied,
// not linked, from the freezedry-webpage repo:
//   extension/src/content/export-markdown.js  (the pipeline logic)
//   extension/src/vendor/{readability,turndown,turndown-plugin-gfm}.js
// There is no build step tying them together, so this is a MANUAL coupling: if
// the extension bumps a vendored library or changes the flow (MIN_ARTICLE_CHARS,
// the READERABLE_* reader gate, the strip selectors, the Turndown options), this
// copy will silently drift. When updating, re-sync against that upstream and
// keep vendor/README.md's version table current.
//
// A page that looks like a prose article (isProbablyReaderable) is extracted with
// Readability and converted to GitHub-flavored Markdown with Turndown. Everything
// else — a dashboard, a list, an app screen — takes the full-page path: the whole
// body is converted, but FIRST every element the browser does not actually render
// is dropped (display:none from ANY stylesheet, not just [hidden]), along with
// scripts/styles, navigation landmarks, and interactive chrome. Exporting only
// what the reader can see keeps pop-up menus, off-screen panels, and hidden forms
// out of the Markdown, and the export never comes back empty.

(function () {
  "use strict";

  const MIN_ARTICLE_CHARS = 500; // below this, Readability's pick counts as "blank"

  // Readerable classifier regexes (see isProbablyReaderable below). Initialized
  // when this script runs — well before page.evaluate calls the exported
  // function — so they are never in their temporal dead zone at call time.
  const READERABLE_UNLIKELY =
    /-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i;
  const READERABLE_MAYBE = /and|article|body|column|content|main|shadow/i;

  // The single entry point websnap_capture.py calls via page.evaluate. Returns
  // { ok:true, markdown, title, mode, chars } or { ok:false, error }.
  window.__websnapExtractMarkdown = function () {
    const capturedAt = new Date();

    try {
      if (
        typeof Readability !== "function" ||
        typeof TurndownService !== "function" ||
        typeof turndownPluginGfm !== "object"
      ) {
        throw new Error(
          "The vendored Markdown libraries could not be loaded."
        );
      }

      // --- 1. Try Readability, but only when the page looks like an article ---
      // isProbablyReaderable keeps Readability away from list/dashboard/app pages
      // it would otherwise mangle (dropping most rows and leaving bare bullets);
      // those take the full-page path below. Readability mutates its input, so it
      // still runs on a clone.
      let article = null;
      if (isProbablyReaderable(document)) {
        try {
          article = new Readability(cloneDocumentWithLiveImages()).parse();
        } catch (error) {
          article = null; // an unparseable page just falls back to full-page mode
        }
      }
      const articleText =
        article && article.textContent ? article.textContent.trim() : "";
      const useArticle = articleText.length >= MIN_ARTICLE_CHARS;

      // --- 2. Build the DOM container to convert ----------------------------
      let container;
      let title = "";
      if (useArticle) {
        // article.content is an HTML string whose URLs Readability already made
        // absolute (and whose lazy-loaded images it already fixed).
        const parsed = new DOMParser().parseFromString(
          article.content,
          "text/html"
        );
        container = parsed.body;
        title = (article.title || "").trim();
      } else {
        // Full-page path: clone only what the browser actually renders, then drop
        // scripts/styles/hidden decoration and interactive chrome.
        container = buildVisiblePageClone();
        stripNonContent(container);
        stripChrome(container);
        absolutizeUrls(container);
      }
      if (!title) {
        title = (document.title || "").trim() || location.hostname;
      }

      // --- 3. Convert to Markdown -------------------------------------------
      const turndown = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        hr: "---",
        bulletListMarker: "-"
      });
      turndown.use(turndownPluginGfm.gfm);
      turndown.remove(["script", "style", "noscript", "template"]);
      const body = turndown.turndown(container);

      const byline =
        useArticle && article.byline ? String(article.byline).trim() : "";
      const markdown = composeDocument(body, title, byline, capturedAt);

      return {
        ok: true,
        markdown: markdown,
        title: title,
        mode: useArticle ? "article" : "page",
        chars: articleText.length
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  };

  // --- document assembly ----------------------------------------------------

  // YAML frontmatter (title, source url, fetch timestamp, and author when
  // Readability found a byline), then the converted body. Images keep the
  // absolute remote URLs Readability/absolutizeUrls produced — websnap does not
  // inline them.
  function composeDocument(body, title, byline, capturedAt) {
    const front = ["---"];
    front.push("title: " + yamlString(title));
    front.push("url: " + yamlString(document.URL));
    front.push("date: " + capturedAt.toISOString());
    if (byline) {
      front.push("author: " + yamlString(byline));
    }
    front.push("---");
    return front.join("\n") + "\n\n" + body.trim() + "\n";
  }

  // Encode a value as a double-quoted YAML scalar: escape backslashes and double
  // quotes and flatten newlines, so a title or URL that contains ':', '"', '#',
  // or a line break can't break the frontmatter block.
  function yamlString(value) {
    const s = String(value == null ? "" : value);
    return (
      '"' +
      s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ") +
      '"'
    );
  }

  // --- article detection ----------------------------------------------------

  // Ported from @mozilla/readability's Readability-readerable.js (Apache-2.0, the
  // same project as the vendored Readability, which does not ship this helper).
  // Returns true when it reads like a prose article: it sums sqrt(text length)
  // over visible <p>/<pre>/<article> blocks (ignoring boilerplate-looking ones)
  // and asks whether that clears a small score. A list/dashboard/app screen has
  // no such prose and scores ~0, so it takes the full-page path instead of being
  // mangled by Readability.
  function isProbablyReaderable(doc) {
    const minContentLength = 140;
    const minScore = 20;
    const nodes = Array.prototype.slice.call(
      doc.querySelectorAll("p, pre, article")
    );
    // A <div> whose only "paragraph" is a run of <br>s counts too.
    for (const br of doc.querySelectorAll("div > br")) {
      if (br.parentNode && nodes.indexOf(br.parentNode) === -1) {
        nodes.push(br.parentNode);
      }
    }

    let score = 0;
    return nodes.some(function (node) {
      if (!isReaderableNodeVisible(node)) {
        return false;
      }
      const matchString = (node.className || "") + " " + (node.id || "");
      if (
        READERABLE_UNLIKELY.test(matchString) &&
        !READERABLE_MAYBE.test(matchString)
      ) {
        return false;
      }
      if (node.matches && node.matches("li p")) {
        return false;
      }
      const textContentLength = node.textContent.trim().length;
      if (textContentLength < minContentLength) {
        return false;
      }
      score += Math.sqrt(textContentLength - minContentLength);
      return score > minScore;
    });
  }

  // The visibility test Mozilla pairs with isProbablyReaderable: inline style and
  // the hidden attributes only (it must stay cheap and run before layout is
  // trusted). fallback-image nodes stay visible on purpose.
  function isReaderableNodeVisible(node) {
    return (
      (!node.style || node.style.display !== "none") &&
      (!node.style || node.style.visibility !== "hidden") &&
      !node.hasAttribute("hidden") &&
      (!node.hasAttribute("aria-hidden") ||
        node.getAttribute("aria-hidden") !== "true" ||
        (node.className &&
          typeof node.className === "string" &&
          node.className.indexOf("fallback-image") !== -1))
    );
  }

  // --- full-page fallback cleanup -------------------------------------------

  // Drop elements that can never contribute to Markdown (code, styling, frames,
  // media chrome) plus anything the page itself marks as hidden. Navigation
  // landmarks and interactive controls are removed separately by stripChrome;
  // ordinary link lists that are neither (a plain footer, say) stay — in the
  // full-page path the user asked for the whole page.
  function stripNonContent(container) {
    const selector = [
      "script", "style", "noscript", "template", "iframe", "frame",
      "object", "embed", "canvas", "audio", "video", "svg", "math",
      "link", "meta", "dialog", "[hidden]", '[aria-hidden="true"]'
    ].join(", ");
    for (const node of container.querySelectorAll(selector)) {
      node.remove();
    }
  }

  // Clone the body, carry each live image's currentSrc onto its clone, and drop
  // every element the browser does not actually render — display:none from ANY
  // stylesheet (not just [hidden]), which is how sites hide pop-up menus,
  // inactive tab panels, and edit forms. The clone must be measured against the
  // LIVE tree, so a single index-aligned pass does the currentSrc copy and the
  // hidden-node marking together, before any node is removed. getElementsByTagName
  // walks both trees in the same document order, so element i lines up with
  // element i as long as we mutate only after the loop.
  function buildVisiblePageClone() {
    const liveRoot = document.body || document.documentElement;
    const clone = liveRoot.cloneNode(true);
    const view = document.defaultView;
    const liveEls = liveRoot.getElementsByTagName("*");
    const cloneEls = clone.getElementsByTagName("*");
    const count = Math.min(liveEls.length, cloneEls.length);
    for (let i = 0; i < count; i += 1) {
      const live = liveEls[i];
      const twin = cloneEls[i];
      if (live.tagName === "IMG" && live.currentSrc) {
        twin.setAttribute("src", live.currentSrc);
      }
      if (isRenderedHidden(live, view)) {
        twin.setAttribute("data-websnap-hidden", "");
      }
    }
    for (const node of clone.querySelectorAll("[data-websnap-hidden]")) {
      node.remove();
    }
    return clone;
  }

  // True when the live element paints nothing AND removing it drops nothing the
  // reader can see. No client rects usually means display:none (from any source)
  // — the whole subtree is hidden, safe to drop. The exception is display:contents:
  // it also has no box of its own, but its children render in its place, so it is
  // KEPT (a hidden child, if any, is dropped on its own). visibility:hidden/collapse
  // still occupies space (it has rects) and a descendant may set visibility:visible
  // to re-show itself, so it is treated as hidden only for a childless element —
  // otherwise a hidden wrapper could take a visible child down with it. Screen-
  // reader-only text (clipped / off-screen) still paints, so it too is KEPT — it
  // often carries the accessible label we want. Reads only the live DOM; never
  // mutates it.
  function isRenderedHidden(el, view) {
    const computeStyle =
      view && typeof view.getComputedStyle === "function"
        ? function () { return view.getComputedStyle(el); }
        : function () { return null; };
    if (
      typeof el.getClientRects === "function" &&
      el.getClientRects().length === 0
    ) {
      const style = computeStyle();
      return !(style && style.display === "contents");
    }
    if (el.childElementCount === 0) {
      const style = computeStyle();
      if (
        style &&
        (style.visibility === "hidden" || style.visibility === "collapse")
      ) {
        return true;
      }
    }
    return false;
  }

  // Chrome, not document content: navigation landmarks (global/section nav,
  // breadcrumbs) and interactive controls (form controls and ARIA widgets —
  // buttons, menus, toolbars, tabs, dialogs). Removing these generically leaves
  // the readable body behind; links and text inside real content are untouched,
  // so it reads the same on any site.
  function stripChrome(container) {
    const selector = [
      "nav", '[role="navigation"]',
      "button", "input", "select", "textarea",
      '[role="button"]', '[role="menu"]', '[role="menubar"]',
      '[role="toolbar"]', '[role="tab"]', '[role="tablist"]',
      '[role="dialog"]', '[role="alertdialog"]', '[role="search"]',
      '[role="tooltip"]'
    ].join(", ");
    for (const node of container.querySelectorAll(selector)) {
      node.remove();
    }
  }

  // Readability absolutizes URLs for the article path; the fallback path must do
  // it itself so links and images survive outside the page's base URL.
  function absolutizeUrls(container) {
    for (const anchor of container.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href");
      try {
        const url = new URL(href, document.baseURI);
        if (url.protocol === "javascript:") {
          anchor.removeAttribute("href"); // Turndown then keeps just the text
        } else {
          anchor.setAttribute("href", url.href);
        }
      } catch (error) {
        anchor.removeAttribute("href");
      }
    }
    for (const img of container.querySelectorAll("img[src]")) {
      try {
        img.setAttribute(
          "src",
          new URL(img.getAttribute("src"), document.baseURI).href
        );
      } catch (error) {
        img.removeAttribute("src");
      }
    }
  }

  // --- helpers -------------------------------------------------------------

  // Clone the whole document, then copy each live image's currentSrc onto its
  // clone: currentSrc reflects the srcset candidate / lazy-loaded URL actually
  // rendered, and it is lost by a plain cloneNode. (document.images and
  // clone.images enumerate the same tree in the same order.)
  function cloneDocumentWithLiveImages() {
    const clone = document.cloneNode(true);
    const liveImages = document.images;
    const cloneImages = clone.images;
    if (
      liveImages && cloneImages &&
      liveImages.length === cloneImages.length
    ) {
      for (let i = 0; i < liveImages.length; i += 1) {
        if (liveImages[i].currentSrc) {
          cloneImages[i].setAttribute("src", liveImages[i].currentSrc);
        }
      }
    }
    return clone;
  }
})();
