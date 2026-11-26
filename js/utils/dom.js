const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

// Replaces en and em dashes in database copy with spaced ASCII hyphens.
export function normalizeDashes(value) {
  if (!value) return "";
  return String(value).replace(/\s*[\u2013\u2014]\s*/g, " - ");
}

// Rejects javascript:, data:, and protocol-relative // URIs when binding dynamic URLs.
export function sanitizeUrl(
  rawUrl,
  fallback = "",
  { allowContactProtocols = false } = {},
) {
  if (!rawUrl || typeof rawUrl !== "string") return fallback;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("//")) return fallback;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;

  try {
    const parsed = new URL(trimmed, window.location.origin);
    const allowedProtocols = allowContactProtocols
      ? ["http:", "https:", "mailto:", "tel:"]
      : ["http:", "https:"];
    if (allowedProtocols.includes(parsed.protocol)) {
      return trimmed;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

const ALLOWED_RICH_TAGS = new Set([
  "A",
  "B",
  "BR",
  "DEL",
  "EM",
  "I",
  "LI",
  "OL",
  "P",
  "S",
  "STRONG",
  "U",
  "UL",
]);

// Portfolio and education descriptions in Supabase contain inline HTML links and emphasis.
export function sanitizeRichText(dirtyHtml) {
  if (!dirtyHtml) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(dirtyHtml), "text/html");

  function cleanNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent || "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return document.createDocumentFragment();
    }

    const rawTagName = node.tagName.toUpperCase();
    const tagName = rawTagName === "STRIKE" ? "S" : rawTagName;
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(tagName)) {
      return document.createDocumentFragment();
    }

    const container = ALLOWED_RICH_TAGS.has(tagName)
      ? document.createElement(tagName.toLowerCase())
      : document.createDocumentFragment();

    if (tagName === "A" && container instanceof HTMLElement) {
      const safeHref = sanitizeUrl(node.getAttribute("href"), "#", {
        allowContactProtocols: true,
      });
      container.setAttribute("href", safeHref);
      if (!safeHref.startsWith("#")) {
        container.setAttribute("target", "_blank");
        container.setAttribute("rel", "noopener noreferrer");
      }
    }

    Array.from(node.childNodes).forEach((child) => {
      container.appendChild(cleanNode(child));
    });
    return container;
  }

  const wrapper = document.createElement("div");
  Array.from(doc.body.childNodes).forEach((child) => {
    wrapper.appendChild(cleanNode(child));
  });
  return wrapper.innerHTML;
}

// Preserves existing block HTML and wraps plain newline-separated paragraphs in <p> tags.
export function formatRichTextHtml(rawText) {
  if (!rawText) return "";
  const trimmed = String(rawText).trim();
  if (!trimmed) return "";

  if (/<(?:p|ul|ol|li)\b/i.test(trimmed)) {
    return sanitizeRichText(trimmed);
  }

  const normalized = trimmed.replace(/<br\s*\/?>\s*<br\s*\/?>/gi, "\n\n");
  const paragraphs = normalized
    .split(/\r?\n\s*\r?\n|\r?\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return "";
  const wrapped = paragraphs.map((chunk) => `<p>${chunk}</p>`).join("");
  return sanitizeRichText(wrapped);
}

// Experience descriptions are stored either as a JSON array string or plain text.
export function parseDescriptionList(rawDescription) {
  if (!rawDescription) return [];
  if (Array.isArray(rawDescription)) {
    return rawDescription.map((item) => String(item).trim()).filter(Boolean);
  }
  const text = String(rawDescription).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    return [text];
  }
  return [text];
}

export function formatDate(isoString, options = {}) {
  if (!isoString) return "Unknown date";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const formatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  };
  return new Intl.DateTimeFormat("en-US", formatOptions).format(date);
}

export function formatDateTime(isoString) {
  return formatDate(isoString, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return "Just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(isoString);
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

const MODAL_TRANSITION_MS = 260;
const activeModalControllers = new WeakMap();
const closingTimers = new WeakMap();

export function createFocusTrap(container, { onEscape } = {}) {
  let previousActiveElement = null;

  function getFocusableElements() {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      (el) => !el.hasAttribute("hidden") && el.offsetParent !== null,
    );
  }

  function handleKeyDown(event) {
    if (event.key === "Escape") {
      if (typeof onEscape === "function") {
        event.preventDefault();
        onEscape(event);
      }
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = getFocusableElements();
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return {
    activate(triggerElement = document.activeElement) {
      previousActiveElement = triggerElement;
      document.addEventListener("keydown", handleKeyDown);
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        container.setAttribute("tabindex", "-1");
        container.focus();
      }
    },
    deactivate() {
      document.removeEventListener("keydown", handleKeyDown);
      if (
        previousActiveElement &&
        typeof previousActiveElement.focus === "function"
      ) {
        previousActiveElement.focus();
      }
    },
  };
}

export function openModalDialog(dialogEl, triggerEl = document.activeElement) {
  if (!dialogEl) return;

  const pendingClose = closingTimers.get(dialogEl);
  if (pendingClose) {
    clearTimeout(pendingClose.timerId);
    closingTimers.delete(dialogEl);
  }
  dialogEl.classList.remove("is-closing");

  const closeHandler = () => closeModalDialog(dialogEl);
  const trap = createFocusTrap(dialogEl, { onEscape: closeHandler });

  const onBackdropClick = (event) => {
    if (event.target === dialogEl) {
      closeModalDialog(dialogEl);
    }
  };

  const onNativeCancel = (event) => {
    event.preventDefault();
    closeModalDialog(dialogEl);
  };

  activeModalControllers.set(dialogEl, {
    trap,
    onBackdropClick,
    onNativeCancel,
  });

  document.body.classList.add("is-scroll-locked");
  dialogEl.addEventListener("click", onBackdropClick);
  dialogEl.addEventListener("cancel", onNativeCancel);

  if (typeof dialogEl.showModal === "function") {
    if (!dialogEl.open) dialogEl.showModal();
  } else {
    dialogEl.removeAttribute("hidden");
    dialogEl.setAttribute("open", "");
  }

  trap.activate(triggerEl);
}

// Plays the 260ms closing transition via .is-closing before calling .close() and restoring focus.
export function closeModalDialog(dialogEl) {
  if (!dialogEl || dialogEl.classList.contains("is-closing")) return;

  const controller = activeModalControllers.get(dialogEl);
  if (controller) {
    dialogEl.removeEventListener("click", controller.onBackdropClick);
    dialogEl.removeEventListener("cancel", controller.onNativeCancel);
    activeModalControllers.delete(dialogEl);
  }

  function finalizeClose() {
    closingTimers.delete(dialogEl);
    dialogEl.classList.remove("is-closing");

    if (typeof dialogEl.close === "function" && dialogEl.open) {
      dialogEl.close();
    } else {
      dialogEl.removeAttribute("open");
      dialogEl.setAttribute("hidden", "");
    }

    if (controller) {
      controller.trap.deactivate();
    }

    const anyOpenModal = document.querySelector("dialog[open], .modal-dialog[open]");
    if (!anyOpenModal) {
      document.body.classList.remove("is-scroll-locked");
    }
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion || !dialogEl.open) {
    finalizeClose();
    return;
  }

  dialogEl.classList.add("is-closing");
  const timerId = setTimeout(finalizeClose, MODAL_TRANSITION_MS);
  closingTimers.set(dialogEl, { timerId });
}

export function renderLoadingState(container, { title = "Loading content", count = 2 } = {}) {
  if (!container) return;
  const blocks = Array.from({ length: count })
    .map(() => '<div class="skeleton-block" aria-hidden="true"></div>')
    .join("");
  container.innerHTML = `
    <div class="ui-state ui-state--loading" role="status" aria-live="polite" aria-busy="true">
      <span class="ui-state-kicker">Loading</span>
      <p class="ui-state-title">${escapeHtml(title)}</p>
      <div class="skeleton-grid">${blocks}</div>
    </div>
  `;
}

export function renderEmptyState(
  container,
  { title = "No entries published yet", message = "New work will appear here once published." } = {},
) {
  if (!container) return;
  container.innerHTML = `
    <div class="ui-state ui-state--empty" role="status">
      <span class="ui-state-kicker">Empty</span>
      <p class="ui-state-title">${escapeHtml(title)}</p>
      <p class="ui-state-message">${escapeHtml(message)}</p>
    </div>
  `;
}

export function renderErrorState(
  container,
  {
    title = "Unable to load this section",
    message = "Check your connection and try loading the data again.",
    retryLabel = "Retry loading",
    onRetry = null,
  } = {},
) {
  if (!container) return;
  container.innerHTML = `
    <div class="ui-state ui-state--error" role="alert">
      <span class="ui-state-kicker">Error</span>
      <p class="ui-state-title">${escapeHtml(title)}</p>
      <p class="ui-state-message">${escapeHtml(message)}</p>
      ${
        typeof onRetry === "function"
          ? `<div class="ui-state-actions"><button type="button" class="btn btn-secondary ui-state-retry">${escapeHtml(retryLabel)}</button></div>`
          : ""
      }
    </div>
  `;
  if (typeof onRetry === "function") {
    const retryBtn = container.querySelector(".ui-state-retry");
    if (retryBtn) retryBtn.addEventListener("click", onRetry);
  }
}
