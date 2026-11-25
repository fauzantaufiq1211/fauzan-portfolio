import { DB_TABLES, supabase } from "../config/supabase-client.js";
import {
  escapeHtml,
  formatDateTime,
  formatRelativeTime,
  renderEmptyState,
  renderErrorState,
  renderLoadingState,
} from "../utils/dom.js";

const LOCAL_READ_STORAGE_KEY = "inbox-read-ids";
const STRICT_EMAIL_PATTERN =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

let activeTableName = DB_TABLES.MESSAGES;
let hasIsReadColumn = null;
let inboxMessages = [];
let activeFilter = "all";
let selectedMessageId = null;

// Probes the live "messages" table first and falls back to "contact_messages" if migrated.
async function resolveMessagesTableAndSchema() {
  if (hasIsReadColumn !== null) return;

  const probePrimary = await supabase
    .from(DB_TABLES.MESSAGES)
    .select("id")
    .limit(1);

  if (
    probePrimary.error &&
    (probePrimary.error.code === "42P01" ||
      probePrimary.error.code === "PGRST205")
  ) {
    activeTableName = "contact_messages";
  } else {
    activeTableName = DB_TABLES.MESSAGES;
  }

  try {
    const { error } = await supabase
      .from(activeTableName)
      .select("is_read")
      .limit(1);
    hasIsReadColumn = !error;
  } catch {
    hasIsReadColumn = false;
  }
}

function getLocalReadIds() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_READ_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setLocalReadIds(ids) {
  try {
    localStorage.setItem(LOCAL_READ_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore localStorage quota failure.
  }
}

function isMessageRead(msg) {
  if (hasIsReadColumn && msg.is_read !== undefined) {
    return Boolean(msg.is_read);
  }
  return getLocalReadIds().includes(msg.id);
}

export async function updateInboxUnreadBadge() {
  try {
    await resolveMessagesTableAndSchema();
    let unreadCount = 0;

    if (hasIsReadColumn) {
      const { count } = await supabase
        .from(activeTableName)
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      unreadCount = count || 0;
    } else {
      const { count: totalCount } = await supabase
        .from(activeTableName)
        .select("*", { count: "exact", head: true });
      unreadCount = Math.max(
        0,
        (totalCount || 0) - getLocalReadIds().length,
      );
    }

    const badge = document.getElementById("inbox-unread-badge");
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
        badge.hidden = false;
      } else {
        badge.hidden = true;
      }
    }

    const headerCount = document.getElementById("inbox-header-count");
    if (headerCount) {
      headerCount.textContent =
        unreadCount > 0
          ? `${unreadCount} unread`
          : `${inboxMessages.length} total`;
    }

    return unreadCount;
  } catch {
    return 0;
  }
}

function getFilteredMessages() {
  if (activeFilter === "unread") {
    return inboxMessages.filter((msg) => !msg._isRead);
  }
  if (activeFilter === "read") {
    return inboxMessages.filter((msg) => msg._isRead);
  }
  return inboxMessages;
}

function renderMessageDetail({ openConfirmModal, showToast, onCountsChanged } = {}) {
  const detailContainer = document.getElementById("inbox-detail-container");
  if (!detailContainer) return;

  const current = inboxMessages.find(
    (msg) => String(msg.id) === String(selectedMessageId),
  );

  if (!current) {
    renderEmptyState(detailContainer, {
      title: "Select an inquiry to read",
      message: "Choose any message from the inbox list to inspect contact details and reply.",
    });
    return;
  }

  const senderName = current.name || "Unnamed Sender";
  const senderEmail = current.email || "";
  const senderPhone = current.phone || "";
  const timestamp = formatDateTime(current.created_at);
  const cleanEmail = String(senderEmail).trim();
  const hasSafeEmail =
    Boolean(cleanEmail) &&
    !/[?&\s\r\n]/.test(cleanEmail) &&
    STRICT_EMAIL_PATTERN.test(cleanEmail);
  const mailtoHref = hasSafeEmail
    ? `mailto:${encodeURIComponent(cleanEmail).replace(/%40/g, "@")}?subject=${encodeURIComponent(`Re: Project Inquiry from ${senderName}`)}`
    : "";

  detailContainer.innerHTML = `
    <article class="inbox-detail-panel">
      <header class="inbox-detail-header">
        <div>
          <div class="admin-record-header">
            <h3 class="text-heading-sm">${escapeHtml(senderName)}</h3>
            <span class="tag-chip ${current._isRead ? "" : "tag-chip--accent"}">
              ${current._isRead ? "Read" : "Unread"}
            </span>
          </div>
          <p class="text-body-sm text-secondary" style="margin-top: var(--space-1);">
            ${senderEmail ? `<span>${escapeHtml(senderEmail)}</span>` : ""}
            ${senderPhone ? ` · <span>${escapeHtml(senderPhone)}</span>` : ""}
          </p>
          <p class="text-caption" style="margin-top: var(--space-1);">${escapeHtml(timestamp)}</p>
        </div>
      </header>

      <div class="inbox-detail-body">${escapeHtml(current.message || "")}</div>

      <footer class="inbox-detail-actions">
        <div class="admin-record-actions">
          <button
            type="button"
            class="btn btn-secondary btn-compact"
            id="inbox-toggle-read-btn"
          >
            ${current._isRead ? "Mark as Unread" : "Mark as Read"}
          </button>
          <button
            type="button"
            class="btn btn-subtle btn-compact"
            id="inbox-delete-msg-btn"
          >
            Delete
          </button>
        </div>
        ${
          mailtoHref
            ? `<a href="${escapeHtml(mailtoHref)}" class="btn btn-primary btn-compact">Reply via Email</a>`
            : ""
        }
      </footer>
    </article>
  `;

  const toggleReadBtn = document.getElementById("inbox-toggle-read-btn");
  if (toggleReadBtn) {
    toggleReadBtn.addEventListener("click", async () => {
      const nextRead = !current._isRead;
      const updated = await setMessageReadStatus(current.id, nextRead, { showToast });
      if (!updated) return;
      showToast?.(nextRead ? "Marked as read." : "Marked as unread.");
      renderInboxListView({ openConfirmModal, showToast, onCountsChanged });
      renderMessageDetail({ openConfirmModal, showToast, onCountsChanged });
      await updateInboxUnreadBadge();
    });
  }

  const deleteBtn = document.getElementById("inbox-delete-msg-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      if (typeof openConfirmModal !== "function") return;
      openConfirmModal({
        title: "Delete this inquiry?",
        message: `Permanently delete the message from "${senderName}"?`,
        triggerEl: deleteBtn,
        onConfirm: async () => {
          const { error } = await supabase
            .from(activeTableName)
            .delete()
            .eq("id", current.id);

          if (error) {
            showToast?.(`Delete failed: ${error.message}`, "error");
            return;
          }

          inboxMessages = inboxMessages.filter(
            (m) => String(m.id) !== String(current.id),
          );
          setLocalReadIds(
            getLocalReadIds().filter((id) => String(id) !== String(current.id)),
          );
          selectedMessageId = null;
          showToast?.("Message deleted.");
          renderInboxListView({ openConfirmModal, showToast, onCountsChanged });
          renderMessageDetail({ openConfirmModal, showToast, onCountsChanged });
          await updateInboxUnreadBadge();
          onCountsChanged?.();
        },
      });
    });
  }
}

async function setMessageReadStatus(id, isRead, callbacks = {}) {
  const numId = Number.isNaN(Number(id)) ? id : Number(id);
  const target = inboxMessages.find((m) => String(m.id) === String(numId));
  const previousIsRead = target ? target._isRead : undefined;
  if (target) target._isRead = isRead;

  if (hasIsReadColumn) {
    const { error } = await supabase
      .from(activeTableName)
      .update({ is_read: isRead })
      .eq("id", numId);

    if (error) {
      if (target && previousIsRead !== undefined) {
        target._isRead = previousIsRead;
      }
      callbacks.showToast?.(
        `Unable to update message status: ${error.message}`,
        "error",
      );
      return false;
    }
  }

  const localIds = getLocalReadIds();
  if (isRead && !localIds.includes(numId)) {
    localIds.push(numId);
    setLocalReadIds(localIds);
  } else if (!isRead) {
    setLocalReadIds(localIds.filter((item) => String(item) !== String(numId)));
  }

  return true;
}

function renderInboxListView(callbacks = {}) {
  const listContainer = document.getElementById("inbox-list-container");
  if (!listContainer) return;

  const filtered = getFilteredMessages();
  if (filtered.length === 0) {
    renderEmptyState(listContainer, {
      title:
        activeFilter === "unread"
          ? "No unread inquiries"
          : "No inquiries in this view",
      message: "Project inquiries submitted through your public contact form appear here.",
    });
    return;
  }

  listContainer.innerHTML = filtered
    .map((msg) => {
      const isSelected = String(msg.id) === String(selectedMessageId);
      const isUnread = !msg._isRead;
      const snippet = (msg.message || "").slice(0, 110);

      return `
        <button
          type="button"
          class="inbox-item-btn ${isSelected ? "is-selected" : ""}"
          data-message-id="${escapeHtml(msg.id)}"
        >
          <div class="inbox-item-top">
            <span class="inbox-sender text-body-sm">
              ${isUnread ? '<span class="unread-indicator" aria-label="Unread"></span>' : ""}
              <span>${escapeHtml(msg.name || "Unnamed Sender")}</span>
            </span>
            <span class="text-caption">${escapeHtml(formatRelativeTime(msg.created_at))}</span>
          </div>
          <p class="text-caption">${escapeHtml(msg.email || "")}</p>
          <p class="text-body-sm text-secondary">${escapeHtml(snippet)}${(msg.message || "").length > 110 ? "..." : ""}</p>
        </button>
      `;
    })
    .join("");

  listContainer.querySelectorAll("[data-message-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-message-id");
      selectedMessageId = id;
      const msg = inboxMessages.find((m) => String(m.id) === String(id));
      if (msg && !msg._isRead) {
        const updated = await setMessageReadStatus(msg.id, true, callbacks);
        if (updated) await updateInboxUnreadBadge();
      }
      renderInboxListView(callbacks);
      renderMessageDetail(callbacks);
    });
  });
}

export async function loadInbox(callbacks = {}) {
  const listContainer = document.getElementById("inbox-list-container");
  if (!listContainer) return;

  renderLoadingState(listContainer, {
    title: "Loading project inquiries",
    count: 3,
  });

  try {
    await resolveMessagesTableAndSchema();
    const { data, error } = await supabase
      .from(activeTableName)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    inboxMessages = (data || []).map((msg) => ({
      ...msg,
      _isRead: isMessageRead(msg),
    }));

    renderInboxListView(callbacks);
    renderMessageDetail(callbacks);
    await updateInboxUnreadBadge();
  } catch (error) {
    renderErrorState(listContainer, {
      title: "Unable to load inbox messages",
      message: error?.message || "Check your connection and retry.",
      onRetry: () => loadInbox(callbacks),
    });
  }
}

export function initInboxControls(callbacks = {}) {
  const filterBtns = document.querySelectorAll("[data-inbox-filter]");
  const markAllBtn = document.getElementById("inbox-mark-all-btn");

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.getAttribute("data-inbox-filter") || "all";
      filterBtns.forEach((pill) => {
        const isCurrent =
          pill.getAttribute("data-inbox-filter") === activeFilter;
        pill.classList.toggle("is-active", isCurrent);
        pill.setAttribute("aria-pressed", String(isCurrent));
      });
      renderInboxListView(callbacks);
    });
  });

  if (markAllBtn) {
    markAllBtn.addEventListener("click", async () => {
      if (inboxMessages.length === 0) return;
      await resolveMessagesTableAndSchema();
      if (hasIsReadColumn) {
        const { error } = await supabase
          .from(activeTableName)
          .update({ is_read: true })
          .eq("is_read", false);

        if (error) {
          callbacks.showToast?.(
            `Unable to mark all messages as read: ${error.message}`,
            "error",
          );
          return;
        }
      }
      setLocalReadIds(inboxMessages.map((m) => m.id));
      inboxMessages.forEach((m) => {
        m._isRead = true;
      });
      callbacks.showToast?.("All messages marked as read.");
      renderInboxListView(callbacks);
      renderMessageDetail(callbacks);
      await updateInboxUnreadBadge();
    });
  }
}
