import {
  escapeHtml,
  formatRichTextHtml,
  parseDescriptionList,
  sanitizeRichText,
  sanitizeUrl,
} from "../utils/dom.js";

function convertInlineStyledPasteHtml(dirtyHtml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(dirtyHtml || ""), "text/html");

  doc.querySelectorAll("span").forEach((span) => {
    const style = (span.getAttribute("style") || "").toLowerCase();
    let replacement = null;

    const wrapWith = (tag) => {
      const el = doc.createElement(tag);
      if (replacement) {
        el.appendChild(replacement);
      } else {
        while (span.firstChild) el.appendChild(span.firstChild);
      }
      replacement = el;
    };

    if (/font-weight\s*:\s*(bold|[6-9]00)/.test(style)) wrapWith("strong");
    if (/font-style\s*:\s*italic/.test(style)) wrapWith("em");
    if (/text-decoration[^;]*underline/.test(style)) wrapWith("u");
    if (/text-decoration[^;]*line-through/.test(style)) wrapWith("s");

    if (replacement) {
      span.replaceWith(replacement);
    }
  });

  return sanitizeRichText(doc.body.innerHTML);
}

function buildInitialEditorHtml(rawValue, mode) {
  if (mode === "bullets") {
    const items = parseDescriptionList(rawValue);
    if (items.length === 0) return "<ul><li><br></li></ul>";
    return `<ul>${items.map((item) => `<li>${sanitizeRichText(item)}</li>`).join("")}</ul>`;
  }
  return formatRichTextHtml(rawValue);
}

export function renderRichEditorFieldHtml({
  inputId,
  name,
  label,
  hint = "",
  mode = "prose",
  rawValue = "",
  placeholder = "",
}) {
  const initialHtml = buildInitialEditorHtml(rawValue, mode);
  const hintHtml = hint ? `<p class="form-hint">${escapeHtml(hint)}</p>` : "";

  return `
    <div class="form-group">
      <label id="${escapeHtml(inputId)}-label" class="form-label">${escapeHtml(label)}</label>
      ${hintHtml}
      <div
        class="rich-editor"
        data-rich-editor
        data-rich-mode="${escapeHtml(mode)}"
        data-field-name="${escapeHtml(name)}"
      >
        <div class="rich-toolbar" role="toolbar" aria-label="${escapeHtml(label)} formatting">
          <button type="button" class="rich-toolbar-btn" data-rich-cmd="bold" aria-label="Bold" aria-pressed="false" title="Bold">
            <strong>B</strong>
          </button>
          <button type="button" class="rich-toolbar-btn" data-rich-cmd="italic" aria-label="Italic" aria-pressed="false" title="Italic">
            <em>I</em>
          </button>
          <button type="button" class="rich-toolbar-btn" data-rich-cmd="underline" aria-label="Underline" aria-pressed="false" title="Underline">
            <u>U</u>
          </button>
          <button type="button" class="rich-toolbar-btn" data-rich-cmd="strikeThrough" aria-label="Strikethrough" aria-pressed="false" title="Strikethrough">
            <s>S</s>
          </button>
          <span class="rich-toolbar-sep" aria-hidden="true"></span>
          <button type="button" class="rich-toolbar-btn" data-rich-cmd="insertUnorderedList" aria-label="Bullet list" aria-pressed="false" title="Bullet list">
            &bull; List
          </button>
          <button type="button" class="rich-toolbar-btn" data-rich-action="link" aria-label="Insert or edit link" aria-pressed="false" title="Insert or edit link">
            Link
          </button>
          <button type="button" class="rich-toolbar-btn" data-rich-action="clear" aria-label="Clear formatting" aria-pressed="false" title="Clear formatting">
            Clear
          </button>
        </div>

        <div class="rich-link-bar" data-rich-link-bar hidden>
          <input
            type="url"
            class="form-input rich-link-input"
            data-rich-link-input
            placeholder="https://example.com"
            aria-label="Link URL"
          />
          <button type="button" class="btn btn-primary btn-compact" data-rich-link-apply>Apply</button>
          <button type="button" class="btn btn-subtle btn-compact" data-rich-link-remove>Unlink</button>
          <button type="button" class="btn btn-subtle btn-compact" data-rich-link-cancel>Cancel</button>
        </div>

        <div
          id="${escapeHtml(inputId)}"
          class="rich-editor-surface"
          contenteditable="true"
          role="textbox"
          aria-multiline="true"
          aria-labelledby="${escapeHtml(inputId)}-label"
          data-placeholder="${escapeHtml(placeholder)}"
        >${initialHtml}</div>
      </div>
    </div>
  `;
}

function findAncestorTag(node, root, tagNames) {
  let current = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (current && current !== root) {
    if (current.tagName && tagNames.has(current.tagName.toUpperCase())) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export function initRichEditors(scopeEl, { showToast } = {}) {
  if (!scopeEl) return () => {};

  const controller = new AbortController();
  const { signal } = controller;

  scopeEl.querySelectorAll("[data-rich-editor]").forEach((editorRoot) => {
    const surface = editorRoot.querySelector(".rich-editor-surface");
    const linkBar = editorRoot.querySelector("[data-rich-link-bar]");
    const linkInput = editorRoot.querySelector("[data-rich-link-input]");
    const linkApplyBtn = editorRoot.querySelector("[data-rich-link-apply]");
    const linkRemoveBtn = editorRoot.querySelector("[data-rich-link-remove]");
    const linkCancelBtn = editorRoot.querySelector("[data-rich-link-cancel]");
    const linkToggleBtn = editorRoot.querySelector('[data-rich-action="link"]');
    if (!surface) return;

    let savedRange = null;

    function captureSelectionInSurface() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return null;
      const range = sel.getRangeAt(0);
      if (!surface.contains(range.commonAncestorContainer)) return null;
      return range.cloneRange();
    }

    function restoreSavedSelection() {
      surface.focus();
      if (!savedRange) return;
      const sel = window.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }

    function syncEmptyAttribute() {
      const text = (surface.textContent || "").trim();
      surface.setAttribute("data-empty", String(text.length === 0));
    }

    function syncToolbarStates() {
      const sel = window.getSelection();
      const anchor = sel && sel.rangeCount > 0 ? sel.anchorNode : null;
      const inSurface = anchor && surface.contains(anchor);

      const tagChecks = {
        bold: new Set(["STRONG", "B"]),
        italic: new Set(["EM", "I"]),
        underline: new Set(["U"]),
        strikeThrough: new Set(["S", "DEL", "STRIKE"]),
        insertUnorderedList: new Set(["UL"]),
      };

      editorRoot.querySelectorAll("[data-rich-cmd]").forEach((btn) => {
        const cmd = btn.getAttribute("data-rich-cmd");
        let active = false;
        if (inSurface && tagChecks[cmd]) {
          active = Boolean(findAncestorTag(anchor, surface, tagChecks[cmd]));
          if (!active) {
            try {
              active = document.queryCommandState(cmd);
            } catch {
              active = false;
            }
          }
        }
        btn.setAttribute("aria-pressed", String(active));
        btn.classList.toggle("is-active", active);
      });

      if (linkToggleBtn) {
        const inLink = Boolean(
          (inSurface && findAncestorTag(anchor, surface, new Set(["A"]))) ||
            (linkBar && !linkBar.hidden),
        );
        linkToggleBtn.setAttribute("aria-pressed", String(inLink));
        linkToggleBtn.classList.toggle("is-active", inLink);
      }
    }

    function closeLinkBar() {
      if (!linkBar) return;
      linkBar.hidden = true;
      if (linkInput) linkInput.value = "";
      syncToolbarStates();
    }

    editorRoot._dismissRichLinkBar = () => {
      if (!linkBar || linkBar.hidden) return false;
      closeLinkBar();
      restoreSavedSelection();
      return true;
    };

    // Sync keyboard Shift+Arrow selections so Tabbing to the toolbar retains the active range.
    document.addEventListener(
      "selectionchange",
      () => {
        const nextRange = captureSelectionInSurface();
        if (nextRange) {
          savedRange = nextRange;
          syncToolbarStates();
        }
      },
      { signal },
    );

    surface.addEventListener(
      "focus",
      () => {
        try {
          document.execCommand("defaultParagraphSeparator", false, "p");
        } catch {
          // Ignore unsupported command in non-browser test runners.
        }
        syncToolbarStates();
      },
      { signal },
    );

    ["keyup", "mouseup", "input"].forEach((evt) => {
      surface.addEventListener(
        evt,
        () => {
          const nextRange = captureSelectionInSurface();
          if (nextRange) savedRange = nextRange;
          syncEmptyAttribute();
          syncToolbarStates();
        },
        { signal },
      );
    });

    editorRoot
      .querySelectorAll("[data-rich-cmd], [data-rich-action]")
      .forEach((btn) => {
        btn.addEventListener(
          "mousedown",
          (event) => {
            event.preventDefault();
          },
          { signal },
        );
      });

    editorRoot.querySelectorAll("[data-rich-cmd]").forEach((btn) => {
      btn.addEventListener(
        "click",
        () => {
          const cmd = btn.getAttribute("data-rich-cmd");
          if (!cmd) return;
          if (document.activeElement !== surface) {
            restoreSavedSelection();
          }
          document.execCommand(cmd, false, null);
          savedRange = captureSelectionInSurface();
          syncEmptyAttribute();
          syncToolbarStates();
        },
        { signal },
      );
    });

    const clearBtn = editorRoot.querySelector('[data-rich-action="clear"]');
    clearBtn?.addEventListener(
      "click",
      () => {
        if (document.activeElement !== surface) {
          restoreSavedSelection();
        }
        document.execCommand("removeFormat", false, null);
        document.execCommand("unlink", false, null);
        savedRange = captureSelectionInSurface();
        syncToolbarStates();
      },
      { signal },
    );

    linkToggleBtn?.addEventListener(
      "click",
      () => {
        if (!linkBar || !linkInput) return;
        if (!linkBar.hidden) {
          closeLinkBar();
          restoreSavedSelection();
          return;
        }

        const currentRange = captureSelectionInSurface() || savedRange;
        savedRange = currentRange;
        const existingAnchor = currentRange
          ? findAncestorTag(currentRange.startContainer, surface, new Set(["A"]))
          : null;

        linkInput.value = existingAnchor?.getAttribute("href") || "";
        linkBar.hidden = false;
        syncToolbarStates();
        linkInput.focus();
        linkInput.select();
      },
      { signal },
    );

    function applyLinkFromBar() {
      if (!linkInput) return;
      const rawUrl = linkInput.value.trim();
      const safeHref = sanitizeUrl(rawUrl, "", { allowContactProtocols: true });
      if (!safeHref) {
        showToast?.("Enter a valid https://, http://, or mailto: URL.", "error");
        linkInput.focus();
        return;
      }

      restoreSavedSelection();
      const sel = window.getSelection();
      const anchorNode = sel && sel.rangeCount > 0 ? sel.anchorNode : null;
      const existingAnchor = anchorNode
        ? findAncestorTag(anchorNode, surface, new Set(["A"]))
        : null;

      if (existingAnchor) {
        existingAnchor.setAttribute("href", safeHref);
        if (!safeHref.startsWith("#")) {
          existingAnchor.setAttribute("target", "_blank");
          existingAnchor.setAttribute("rel", "noopener noreferrer");
        }
      } else if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const anchor = document.createElement("a");
        anchor.setAttribute("href", safeHref);
        if (!safeHref.startsWith("#")) {
          anchor.setAttribute("target", "_blank");
          anchor.setAttribute("rel", "noopener noreferrer");
        }
        if (range.collapsed) {
          anchor.textContent = safeHref;
          range.insertNode(anchor);
          range.setStartAfter(anchor);
          range.collapse(true);
        } else {
          anchor.appendChild(range.extractContents());
          range.insertNode(anchor);
          range.selectNodeContents(anchor);
        }
        sel.removeAllRanges();
        sel.addRange(range);
      }

      savedRange = captureSelectionInSurface();
      closeLinkBar();
      syncEmptyAttribute();
    }

    linkApplyBtn?.addEventListener("click", applyLinkFromBar, { signal });

    linkRemoveBtn?.addEventListener(
      "click",
      () => {
        restoreSavedSelection();
        const sel = window.getSelection();
        const anchorNode = sel && sel.rangeCount > 0 ? sel.anchorNode : null;
        const existingAnchor = anchorNode
          ? findAncestorTag(anchorNode, surface, new Set(["A"]))
          : null;
        if (existingAnchor) {
          const parent = existingAnchor.parentNode;
          while (existingAnchor.firstChild) {
            parent.insertBefore(existingAnchor.firstChild, existingAnchor);
          }
          parent.removeChild(existingAnchor);
        } else {
          document.execCommand("unlink", false, null);
        }
        savedRange = captureSelectionInSurface();
        closeLinkBar();
      },
      { signal },
    );

    linkCancelBtn?.addEventListener(
      "click",
      () => {
        closeLinkBar();
        restoreSavedSelection();
      },
      { signal },
    );

    linkInput?.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          applyLinkFromBar();
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeLinkBar();
          restoreSavedSelection();
        }
      },
      { signal },
    );

    surface.addEventListener(
      "paste",
      (event) => {
        event.preventDefault();
        const clipboard = event.clipboardData;
        if (!clipboard) return;

        const htmlData = clipboard.getData("text/html");
        const textData = clipboard.getData("text/plain");
        const mode = editorRoot.getAttribute("data-rich-mode") || "prose";

        let cleanHtml = "";
        if (htmlData && htmlData.trim()) {
          cleanHtml = convertInlineStyledPasteHtml(htmlData);
        } else if (textData) {
          const lines = textData
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          if (mode === "bullets") {
            cleanHtml = lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
          } else {
            cleanHtml = lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
          }
        }

        if (cleanHtml) {
          document.execCommand("insertHTML", false, cleanHtml);
        }
        savedRange = captureSelectionInSurface();
        syncEmptyAttribute();
        syncToolbarStates();
      },
      { signal },
    );

    syncEmptyAttribute();
  });

  return function cleanupRichEditors() {
    controller.abort();
    scopeEl.querySelectorAll("[data-rich-editor]").forEach((editorRoot) => {
      delete editorRoot._dismissRichLinkBar;
    });
  };
}

export function dismissOpenRichLinkBar(scopeEl) {
  if (!scopeEl) return false;
  for (const editorRoot of scopeEl.querySelectorAll("[data-rich-editor]")) {
    if (typeof editorRoot._dismissRichLinkBar === "function") {
      if (editorRoot._dismissRichLinkBar()) return true;
      continue;
    }
    const linkBar = editorRoot.querySelector("[data-rich-link-bar]");
    const linkInput = editorRoot.querySelector("[data-rich-link-input]");
    const surface = editorRoot.querySelector(".rich-editor-surface");
    if (linkBar && !linkBar.hidden) {
      linkBar.hidden = true;
      if (linkInput) linkInput.value = "";
      surface?.focus();
      return true;
    }
  }
  return false;
}

function normalizeEditorClone(surface) {
  const clone = surface.cloneNode(true);

  clone.querySelectorAll("b").forEach((el) => {
    const strong = document.createElement("strong");
    while (el.firstChild) strong.appendChild(el.firstChild);
    el.replaceWith(strong);
  });

  clone.querySelectorAll("i").forEach((el) => {
    const em = document.createElement("em");
    while (el.firstChild) em.appendChild(el.firstChild);
    el.replaceWith(em);
  });

  clone.querySelectorAll("strike, del").forEach((el) => {
    const s = document.createElement("s");
    while (el.firstChild) s.appendChild(el.firstChild);
    el.replaceWith(s);
  });

  clone.querySelectorAll("div").forEach((div) => {
    const p = document.createElement("p");
    while (div.firstChild) p.appendChild(div.firstChild);
    div.replaceWith(p);
  });

  return clone;
}

export function serializeRichEditorValue(editorRootEl) {
  if (!editorRootEl) return null;
  const mode = editorRootEl.getAttribute("data-rich-mode") || "prose";
  const surface = editorRootEl.querySelector(".rich-editor-surface");
  if (!surface) return mode === "bullets" ? JSON.stringify([]) : null;

  const clone = normalizeEditorClone(surface);

  if (mode === "bullets") {
    const items = [];
    const listItems = Array.from(clone.querySelectorAll("li"));

    if (listItems.length > 0) {
      listItems.forEach((li) => {
        if ((li.textContent || "").trim() === "") return;
        let inner = li.innerHTML;
        if (li.children.length === 1 && li.firstElementChild?.tagName === "P") {
          inner = li.firstElementChild.innerHTML;
        }
        const clean = sanitizeRichText(inner).trim();
        if (clean) items.push(clean);
      });
    } else {
      const blocks = Array.from(clone.querySelectorAll("p"));
      if (blocks.length > 0) {
        blocks.forEach((p) => {
          if ((p.textContent || "").trim() === "") return;
          const clean = sanitizeRichText(p.innerHTML).trim();
          if (clean) items.push(clean);
        });
      } else if ((clone.textContent || "").trim() !== "") {
        const clean = sanitizeRichText(clone.innerHTML).trim();
        if (clean) items.push(clean);
      }
    }

    return JSON.stringify(items);
  }

  if ((clone.textContent || "").trim() === "") {
    return null;
  }

  const blockTags = new Set(["P", "UL", "OL"]);
  const outputWrapper = document.createElement("div");
  let inlineBucket = null;

  const flushInlineBucket = () => {
    if (!inlineBucket) return;
    if ((inlineBucket.textContent || "").trim() !== "") {
      outputWrapper.appendChild(inlineBucket);
    }
    inlineBucket = null;
  };

  Array.from(clone.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && blockTags.has(node.tagName.toUpperCase())) {
      flushInlineBucket();
      if ((node.textContent || "").trim() !== "") {
        outputWrapper.appendChild(node.cloneNode(true));
      }
    } else {
      if (!inlineBucket) inlineBucket = document.createElement("p");
      inlineBucket.appendChild(node.cloneNode(true));
    }
  });
  flushInlineBucket();

  const sanitized = sanitizeRichText(outputWrapper.innerHTML).trim();
  return sanitized || null;
}
