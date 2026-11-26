import { escapeHtml } from "../utils/dom.js";

const DEBOUNCE_MS = 120;
const MAX_VISIBLE_OPTIONS = 12;
const shardCache = new Map();
const inflightShards = new Map();

const LEGACY_LOCATION_MAP = new Map([
  ["dki jakarta", "Jakarta, Indonesia"],
  ["dki jakarta, indonesia", "Jakarta, Indonesia"],
  ["jakarta", "Jakarta, Indonesia"],
  ["jakarta selatan", "Jakarta Selatan, Indonesia"],
  ["jakarta pusat", "Jakarta Pusat, Indonesia"],
  ["kediri, east java", "Kediri, Indonesia"],
  ["kediri, jawa timur", "Kediri, Indonesia"],
  ["palembang, south sumatra", "Palembang, Indonesia"],
  ["palembang, sumatera selatan", "Palembang, Indonesia"],
  ["malang, east java", "Malang, Indonesia"],
  ["bogor, west java", "Bogor, Indonesia"],
  ["bandung, west java", "Bandung, Indonesia"],
  ["surabaya, east java", "Surabaya, Indonesia"],
]);

const SPECIAL_LATIN_FOLD = {
  Ł: "L",
  ł: "l",
  Ø: "O",
  ø: "o",
  Đ: "D",
  đ: "d",
  ß: "ss",
  Æ: "AE",
  æ: "ae",
  Œ: "OE",
  œ: "oe",
};

export function stripDiacritics(value) {
  return String(value || "")
    .replace(/[ŁłØøĐđßÆæŒœ]/g, (ch) => SPECIAL_LATIN_FOLD[ch] || ch)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getCityShardKey(rawText) {
  const clean = stripDiacritics(String(rawText || "").trim()).toLowerCase();
  if (!clean) return "other";
  const first = clean[0];
  return first >= "a" && first <= "z" ? first : "other";
}

export function normalizeLegacyLocation(rawLocation) {
  const trimmed = String(rawLocation || "").trim();
  if (!trimmed) return "";
  const mapped = LEGACY_LOCATION_MAP.get(trimmed.toLowerCase());
  return mapped || trimmed;
}

async function loadCityShard(shardKey) {
  if (shardCache.has(shardKey)) {
    return shardCache.get(shardKey);
  }
  if (inflightShards.has(shardKey)) {
    return inflightShards.get(shardKey);
  }

  const request = (async () => {
    const res = await fetch(`/data/cities/${encodeURIComponent(shardKey)}.json`);
    if (!res.ok) {
      throw new Error(`Unable to load city index (${res.status}).`);
    }
    const rawList = await res.json();
    if (!Array.isArray(rawList)) {
      throw new Error("Invalid city index format.");
    }
    const indexed = rawList.map((label) => ({
      label: String(label),
      norm: stripDiacritics(label).toLowerCase(),
    }));
    shardCache.set(shardKey, indexed);
    return indexed;
  })();

  inflightShards.set(shardKey, request);
  try {
    return await request;
  } finally {
    inflightShards.delete(shardKey);
  }
}

export function filterCityEntries(indexedShard, rawQuery, limit = MAX_VISIBLE_OPTIONS) {
  const normQuery = stripDiacritics(String(rawQuery || "").trim()).toLowerCase();
  if (normQuery.length < 2 || !Array.isArray(indexedShard)) return [];

  const exactCityPrefix = `${normQuery},`;
  const exactCityMatches = [];
  const prefixMatches = [];
  const substringMatches = [];

  for (let i = 0; i < indexedShard.length; i += 1) {
    const entry = indexedShard[i];
    if (entry.norm.startsWith(exactCityPrefix)) {
      if (exactCityMatches.length < limit) {
        exactCityMatches.push(entry.label);
      }
    } else if (entry.norm.startsWith(normQuery)) {
      if (prefixMatches.length < limit) {
        prefixMatches.push(entry.label);
      }
    } else if (
      exactCityMatches.length + prefixMatches.length < limit &&
      substringMatches.length < limit &&
      entry.norm.includes(normQuery)
    ) {
      substringMatches.push(entry.label);
    }
  }

  return exactCityMatches
    .concat(prefixMatches, substringMatches)
    .slice(0, limit);
}

// Maps normalized match offsets back to original UTF-16 code units so diacritics highlight accurately.
function findOriginalMatchBounds(label, rawQuery) {
  const normQuery = stripDiacritics(String(rawQuery || "").trim()).toLowerCase();
  if (!normQuery) return null;

  const origStarts = [];
  const origEnds = [];
  let normBuilder = "";

  for (let i = 0; i < label.length; ) {
    const codePoint = label.codePointAt(i);
    const charLen = codePoint > 0xffff ? 2 : 1;
    const rawChar = label.slice(i, i + charLen);
    const folded = stripDiacritics(rawChar).toLowerCase();

    for (let k = 0; k < folded.length; k += 1) {
      origStarts.push(i);
      origEnds.push(i + charLen);
    }
    normBuilder += folded;
    i += charLen;
  }

  const matchIdx = normBuilder.indexOf(normQuery);
  if (matchIdx === -1) return null;

  const endNormIdx = matchIdx + normQuery.length - 1;
  return {
    start: origStarts[matchIdx] ?? 0,
    end: origEnds[endNormIdx] ?? label.length,
  };
}

function appendHighlightedCityLabel(targetEl, label, rawQuery) {
  const bounds = findOriginalMatchBounds(label, rawQuery);
  if (!bounds || bounds.start >= bounds.end) {
    targetEl.appendChild(document.createTextNode(label));
    return;
  }

  if (bounds.start > 0) {
    targetEl.appendChild(document.createTextNode(label.slice(0, bounds.start)));
  }
  const mark = document.createElement("mark");
  mark.className = "city-match-mark";
  mark.textContent = label.slice(bounds.start, bounds.end);
  targetEl.appendChild(mark);

  if (bounds.end < label.length) {
    targetEl.appendChild(document.createTextNode(label.slice(bounds.end)));
  }
}

export function renderCityComboboxFieldHtml({
  inputId,
  name,
  label,
  rawValue = "",
  placeholder = "Search city worldwide (e.g. Jakarta, Tokyo, London)...",
  hint = "",
}) {
  const canonical = normalizeLegacyLocation(rawValue);
  const searchInputId = `${inputId}-search`;
  const listboxId = `${inputId}-listbox`;
  const hintHtml = hint ? `<p class="form-hint">${escapeHtml(hint)}</p>` : "";

  return `
    <div class="form-group" data-city-picker>
      <label for="${escapeHtml(searchInputId)}" class="form-label">${escapeHtml(label)}</label>
      ${hintHtml}
      <div class="city-combobox">
        <div class="city-combobox-control">
          <input
            type="text"
            id="${escapeHtml(searchInputId)}"
            class="form-input city-combobox-input"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="false"
            aria-controls="${escapeHtml(listboxId)}"
            aria-activedescendant=""
            autocomplete="off"
            spellcheck="false"
            value="${escapeHtml(canonical)}"
            placeholder="${escapeHtml(placeholder)}"
            data-city-search-input
          />
          <input
            type="hidden"
            id="${escapeHtml(inputId)}"
            name="${escapeHtml(name)}"
            value="${escapeHtml(canonical)}"
            data-city-canonical-input
          />
          <button
            type="button"
            class="city-clear-btn"
            data-city-clear
            aria-label="Clear selected location"
            ${canonical ? "" : "hidden"}
          >&times;</button>
        </div>
        <div
          id="${escapeHtml(listboxId)}"
          class="city-listbox"
          role="listbox"
          aria-label="${escapeHtml(label)} suggestions"
          hidden
        ></div>
      </div>
    </div>
  `;
}

export function initCityPickers(scopeEl) {
  if (!scopeEl) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const activeTimers = new Set();

  scopeEl.querySelectorAll("[data-city-picker]").forEach((rootEl) => {
    const searchInput = rootEl.querySelector("[data-city-search-input]");
    const canonicalInput = rootEl.querySelector("[data-city-canonical-input]");
    const clearBtn = rootEl.querySelector("[data-city-clear]");
    const listbox = rootEl.querySelector('[role="listbox"]');
    if (!searchInput || !canonicalInput || !listbox) return;

    let confirmedValue = canonicalInput.value.trim();
    let activeIndex = -1;
    let currentOptions = [];
    let debounceTimer = null;
    let requestCounter = 0;

    function clearPendingDebounce() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        activeTimers.delete(debounceTimer);
        debounceTimer = null;
      }
    }

    function syncClearButton() {
      if (!clearBtn) return;
      clearBtn.hidden = searchInput.value.trim().length === 0;
    }

    function closeListbox() {
      clearPendingDebounce();
      requestCounter += 1;
      listbox.hidden = true;
      activeIndex = -1;
      currentOptions = [];
      searchInput.setAttribute("aria-expanded", "false");
      searchInput.setAttribute("aria-activedescendant", "");
    }

    rootEl._dismissCityListbox = () => {
      if (listbox.hidden) return false;
      closeListbox();
      searchInput.focus();
      return true;
    };

    function openListbox() {
      listbox.hidden = false;
      searchInput.setAttribute("aria-expanded", "true");
    }

    function renderListboxStatus(message, isError = false) {
      listbox.textContent = "";
      currentOptions = [];
      activeIndex = -1;
      searchInput.setAttribute("aria-activedescendant", "");

      const statusDiv = document.createElement("div");
      statusDiv.className = isError
        ? "city-listbox-state city-listbox-state--error text-body-sm"
        : "city-listbox-state text-body-sm text-secondary";
      statusDiv.setAttribute("role", isError ? "alert" : "status");
      statusDiv.textContent = message;
      listbox.appendChild(statusDiv);
      openListbox();
    }

    function setActiveOption(nextIndex) {
      const optionBtns = Array.from(listbox.querySelectorAll('[role="option"]'));
      if (optionBtns.length === 0) {
        activeIndex = -1;
        searchInput.setAttribute("aria-activedescendant", "");
        return;
      }

      activeIndex = nextIndex;
      optionBtns.forEach((btn, idx) => {
        const isCurrent = idx === activeIndex;
        btn.classList.toggle("is-active", isCurrent);
        btn.setAttribute("aria-selected", String(isCurrent));
        if (isCurrent) {
          searchInput.setAttribute("aria-activedescendant", btn.id);
          btn.scrollIntoView?.({ block: "nearest" });
        }
      });
      if (activeIndex < 0) {
        searchInput.setAttribute("aria-activedescendant", "");
      }
    }

    function commitCitySelection(cityLabel) {
      confirmedValue = cityLabel;
      searchInput.value = cityLabel;
      canonicalInput.value = cityLabel;
      syncClearButton();
      closeListbox();
      searchInput.focus();
    }

    function renderOptionsList(matches, rawQuery) {
      listbox.textContent = "";
      currentOptions = matches;
      activeIndex = -1;

      if (matches.length === 0) {
        renderListboxStatus(`No matching cities found for "${rawQuery.trim()}".`);
        return;
      }

      const fragment = document.createDocumentFragment();
      matches.forEach((cityLabel, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.id = `${listbox.id}-opt-${idx}`;
        btn.className = "city-option";
        btn.setAttribute("role", "option");
        btn.setAttribute("aria-selected", "false");
        btn.tabIndex = -1;
        appendHighlightedCityLabel(btn, cityLabel, rawQuery);

        btn.addEventListener("mousedown", (event) => {
          event.preventDefault();
        });
        btn.addEventListener("click", () => {
          commitCitySelection(cityLabel);
        });
        fragment.appendChild(btn);
      });

      listbox.appendChild(fragment);
      openListbox();
      setActiveOption(0);
    }

    async function runCitySearch(rawQuery) {
      const trimmed = rawQuery.trim();
      if (trimmed.length < 2) {
        closeListbox();
        return;
      }

      const token = ++requestCounter;
      const shardKey = getCityShardKey(trimmed);

      if (!shardCache.has(shardKey)) {
        renderListboxStatus("Loading cities...");
      }

      try {
        const indexedShard = await loadCityShard(shardKey);
        if (token !== requestCounter) return;
        const matches = filterCityEntries(indexedShard, trimmed, MAX_VISIBLE_OPTIONS);
        renderOptionsList(matches, trimmed);
      } catch (error) {
        if (token !== requestCounter) return;
        renderListboxStatus(
          error?.message || "Unable to load city index. Check your connection.",
          true,
        );
      }
    }

    searchInput.addEventListener(
      "input",
      () => {
        const currentText = searchInput.value;
        const trimmed = currentText.trim();
        syncClearButton();

        if (trimmed === "") {
          confirmedValue = "";
          canonicalInput.value = "";
          closeListbox();
          return;
        }

        if (trimmed !== confirmedValue) {
          canonicalInput.value = "";
        } else {
          canonicalInput.value = confirmedValue;
        }

        clearPendingDebounce();
        if (trimmed.length < 2) {
          closeListbox();
          return;
        }

        debounceTimer = setTimeout(() => {
          activeTimers.delete(debounceTimer);
          debounceTimer = null;
          runCitySearch(currentText);
        }, DEBOUNCE_MS);
        activeTimers.add(debounceTimer);
      },
      { signal },
    );

    searchInput.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          if (listbox.hidden) {
            if (searchInput.value.trim().length >= 2) {
              runCitySearch(searchInput.value);
            }
            return;
          }
          if (currentOptions.length > 0) {
            const next = (activeIndex + 1) % currentOptions.length;
            setActiveOption(next);
          }
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          if (!listbox.hidden && currentOptions.length > 0) {
            const prev =
              activeIndex <= 0 ? currentOptions.length - 1 : activeIndex - 1;
            setActiveOption(prev);
          }
          return;
        }

        if (event.key === "Enter") {
          if (!listbox.hidden && currentOptions.length > 0) {
            event.preventDefault();
            const chosen = currentOptions[activeIndex >= 0 ? activeIndex : 0];
            if (chosen) commitCitySelection(chosen);
          }
          return;
        }

        if (event.key === "Escape" && !listbox.hidden) {
          event.preventDefault();
          event.stopPropagation();
          closeListbox();
          searchInput.focus();
        }
      },
      { signal },
    );

    clearBtn?.addEventListener(
      "click",
      () => {
        confirmedValue = "";
        searchInput.value = "";
        canonicalInput.value = "";
        syncClearButton();
        closeListbox();
        searchInput.focus();
      },
      { signal },
    );

    const parentDialog = rootEl.closest("dialog") || document;
    parentDialog.addEventListener(
      "click",
      (event) => {
        if (!listbox.hidden && !rootEl.contains(event.target)) {
          closeListbox();
        }
      },
      { signal },
    );
  });

  return function cleanupCityPickers() {
    activeTimers.forEach((timerId) => clearTimeout(timerId));
    activeTimers.clear();
    controller.abort();
    scopeEl.querySelectorAll("[data-city-picker]").forEach((rootEl) => {
      delete rootEl._dismissCityListbox;
    });
  };
}

export function dismissOpenCityPicker(scopeEl) {
  if (!scopeEl) return false;
  for (const rootEl of scopeEl.querySelectorAll("[data-city-picker]")) {
    if (typeof rootEl._dismissCityListbox === "function") {
      if (rootEl._dismissCityListbox()) return true;
      continue;
    }
    const listbox = rootEl.querySelector('[role="listbox"]');
    const searchInput = rootEl.querySelector("[data-city-search-input]");
    if (listbox && !listbox.hidden) {
      listbox.hidden = true;
      searchInput?.setAttribute("aria-expanded", "false");
      searchInput?.setAttribute("aria-activedescendant", "");
      searchInput?.focus();
      return true;
    }
  }
  return false;
}

export function validateCityPickerField(scopeEl) {
  const pickerEl = scopeEl?.querySelector("[data-city-picker]");
  if (!pickerEl) return { valid: true, value: null, inputEl: null };

  const searchInput = pickerEl.querySelector("[data-city-search-input]");
  const canonicalInput = pickerEl.querySelector("[data-city-canonical-input]");
  const typed = String(searchInput?.value || "").trim();
  const canonical = String(canonicalInput?.value || "").trim();

  if (typed === "") {
    return { valid: true, value: null, inputEl: searchInput };
  }

  if (!canonical || canonical !== typed) {
    return {
      valid: false,
      value: null,
      inputEl: searchInput,
      error:
        "Select a city from the dropdown suggestions, or clear the Location field.",
    };
  }

  return { valid: true, value: canonical, inputEl: searchInput };
}
