import { STATIC_ASSETS } from "../config/supabase-client.js";
import {
  closeModalDialog,
  openModalDialog,
  sanitizeUrl,
} from "../utils/dom.js";

const galleries = new Map();
let activeGalleryId = null;
let activeSlideIndex = 0;

const LEGAL_DOCUMENTS = {
  terms: {
    title: "Terms of Service",
    updated: "Last updated: November 2026",
    html: `
      <div class="legal-prose">
        <section class="legal-section">
          <h4>1. Scope of Use</h4>
          <p>Welcome to <strong>fauzantaufiq.id</strong>. By accessing this portfolio website, you agree to these Terms of Service. If you disagree with any part of these terms, please discontinue use of the site.</p>
        </section>
        <section class="legal-section">
          <h4>2. Intellectual Property Rights</h4>
          <p>Unless credited to a specific client or public institution, Muhammad Fauzan Taufiq owns the intellectual property rights for the portfolio layout, source code, case study narratives, and original visual assets on this site. Client campaign visuals remain the property of their respective brand owners and are displayed strictly for professional portfolio demonstration.</p>
        </section>
        <section class="legal-section">
          <h4>3. Usage Restrictions</h4>
          <p>Visitors are not permitted to:</p>
          <ul>
            <li>Republish, redistribute, or sell visual case study assets without prior written consent.</li>
            <li>Use automated scraping tools or attempt unauthorized access to the administrative backend.</li>
            <li>Misrepresent displayed client campaigns or visual identities as their own work.</li>
          </ul>
        </section>
        <section class="legal-section">
          <h4>4. Accuracy and External Links</h4>
          <p>Case studies reflect real project deliverables and reported campaign outcomes at the time of publication. This website links to external platforms including LinkedIn, Behance, Instagram, and client websites, which operate under their own terms and privacy policies.</p>
        </section>
        <section class="legal-section">
          <h4>5. Limitation of Liability</h4>
          <p>This website is provided on an "as is" basis for portfolio evaluation and professional inquiries. Muhammad Fauzan Taufiq is not liable for indirect or consequential damages arising from your access to or use of this site.</p>
        </section>
      </div>
    `,
  },
  privacy: {
    title: "Privacy Policy",
    updated: "Last updated: November 2026",
    html: `
      <div class="legal-prose">
        <section class="legal-section">
          <h4>1. Data Controller</h4>
          <p>Muhammad Fauzan Taufiq operates <strong>fauzantaufiq.id</strong>. This policy explains what personal data is collected when you submit a project inquiry or browse this portfolio.</p>
        </section>
        <section class="legal-section">
          <h4>2. Information Collected</h4>
          <ul>
            <li><strong>Inquiry Data:</strong> When you submit the contact form, your Full Name, Email Address, Phone or WhatsApp Number, and Project Brief are stored in a secured database solely to respond to your inquiry.</li>
            <li><strong>Analytics Data:</strong> Anonymous traffic diagnostics (page views, device type, and session duration) are collected via Google Analytics to evaluate site performance.</li>
          </ul>
        </section>
        <section class="legal-section">
          <h4>3. Infrastructure Partners</h4>
          <p>This site relies on trusted infrastructure providers bound by strict data protection obligations:</p>
          <ul>
            <li><strong>Vercel:</strong> Static hosting and edge delivery.</li>
            <li><strong>Supabase:</strong> PostgreSQL database with Row-Level Security (RLS) policies protecting inquiry records.</li>
            <li><strong>Cloudflare:</strong> DNS routing, TLS encryption, and DDoS mitigation.</li>
            <li><strong>Google Analytics:</strong> Aggregated visitor telemetry.</li>
          </ul>
        </section>
        <section class="legal-section">
          <h4>4. Your Data Rights</h4>
          <p>You may request access to, correction of, or permanent deletion of any inquiry data you have submitted by emailing <a href="mailto:contact@fauzantaufiq.id">contact@fauzantaufiq.id</a>.</p>
        </section>
      </div>
    `,
  },
};

export function registerGallery(galleryId, items) {
  if (!galleryId || !Array.isArray(items)) return;
  galleries.set(galleryId, items);
}

function updateLightboxView() {
  const items = galleries.get(activeGalleryId) || [];
  if (items.length === 0) return;

  const current = items[activeSlideIndex];
  const imgEl = document.getElementById("lightbox-image");
  const titleEl = document.getElementById("lightbox-title");
  const metaEl = document.getElementById("lightbox-meta");
  const counterEl = document.getElementById("lightbox-counter");
  const externalLinkEl = document.getElementById("lightbox-external-link");
  const prevBtn = document.getElementById("lightbox-prev");
  const nextBtn = document.getElementById("lightbox-next");

  if (imgEl) {
    imgEl.src = sanitizeUrl(current.src);
    imgEl.alt = current.title || "Campaign artifact preview";
  }
  if (titleEl) {
    titleEl.textContent = current.title || "Campaign Artifact";
  }
  if (metaEl) {
    metaEl.textContent = current.subtitle || "";
  }
  if (counterEl) {
    counterEl.textContent = `${activeSlideIndex + 1} of ${items.length}`;
  }

  if (externalLinkEl) {
    const safeExternal = sanitizeUrl(current.externalUrl);
    if (safeExternal) {
      externalLinkEl.href = safeExternal;
      externalLinkEl.textContent = current.actionLabel || "Open Live Post";
      externalLinkEl.hidden = false;
    } else {
      externalLinkEl.hidden = true;
      externalLinkEl.removeAttribute("href");
    }
  }

  const hasMultiple = items.length > 1;
  if (prevBtn) {
    prevBtn.disabled = !hasMultiple;
    prevBtn.setAttribute("aria-disabled", String(!hasMultiple));
  }
  if (nextBtn) {
    nextBtn.disabled = !hasMultiple;
    nextBtn.setAttribute("aria-disabled", String(!hasMultiple));
  }
}

export function stepLightbox(delta) {
  const items = galleries.get(activeGalleryId) || [];
  if (items.length <= 1) return;
  activeSlideIndex = (activeSlideIndex + delta + items.length) % items.length;
  updateLightboxView();
}

export function openLightbox(galleryId, index = 0, triggerEl = document.activeElement) {
  const dialog = document.getElementById("lightbox-dialog");
  const items = galleries.get(galleryId) || [];
  if (!dialog || items.length === 0) return;

  activeGalleryId = galleryId;
  activeSlideIndex = Math.max(0, Math.min(index, items.length - 1));
  updateLightboxView();
  openModalDialog(dialog, triggerEl);
}

function isSafariOrWebKitBrowser() {
  const ua = window.navigator?.userAgent || "";
  const isSafari =
    /Safari/i.test(ua) &&
    !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS|Firefox/i.test(ua);
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (window.navigator?.platform === "MacIntel" &&
      (window.navigator?.maxTouchPoints || 0) > 1);
  return isSafari || isIOS;
}

function toGoogleDrivePreviewUrl(url) {
  return url.replace(/\/view(?:\?[^#]*)?$/i, "/preview");
}

// Opens dialog before binding <object> data so WebKit PDFKit measures non-zero dimensions on Safari.
export function openDocumentModal(
  url,
  title = "Document Preview",
  triggerEl = document.activeElement,
) {
  const dialog = document.getElementById("document-dialog");
  const objectEl = document.getElementById("document-object");
  const frame = document.getElementById("document-frame");
  const titleEl = document.getElementById("document-title");
  const downloadLink = document.getElementById("document-download-link");
  const openLink = document.getElementById("document-open-link");

  const safeUrl = sanitizeUrl(url);
  if (!dialog || !frame || !safeUrl) return;

  if (titleEl) titleEl.textContent = title;
  if (downloadLink) downloadLink.href = safeUrl;
  if (openLink) openLink.href = safeUrl;

  openModalDialog(dialog, triggerEl);
  void dialog.offsetHeight;

  let parsedHost = "";
  try {
    parsedHost = new URL(safeUrl, window.location.origin).hostname.toLowerCase();
  } catch {
    parsedHost = "";
  }

  const isGoogleDriveHost =
    parsedHost === "drive.google.com" ||
    parsedHost.endsWith(".drive.google.com");

  if (isGoogleDriveHost) {
    const previewUrl = toGoogleDrivePreviewUrl(safeUrl);
    if (objectEl) {
      objectEl.removeAttribute("data");
      objectEl.removeAttribute("type");
    }
    frame.src = previewUrl;
    return;
  }

  const isSameOrigin =
    safeUrl.startsWith("/") || safeUrl.startsWith(window.location.origin);
  const usePlainPdfUrl = isSafariOrWebKitBrowser() || window.innerWidth < 768;
  const viewerUrl =
    !usePlainPdfUrl && isSameOrigin ? `${safeUrl}#view=FitH` : safeUrl;

  frame.src = viewerUrl;
  if (objectEl) {
    objectEl.setAttribute("type", "application/pdf");
    objectEl.setAttribute("data", viewerUrl);
  }
}

export function openResumeModal(triggerEl = document.activeElement) {
  openDocumentModal(
    STATIC_ASSETS.RESUME_PDF,
    "Resume: Muhammad Fauzan Taufiq",
    triggerEl,
  );
}

export function openLegalModal(type, triggerEl = document.activeElement) {
  const dialog = document.getElementById("legal-dialog");
  const titleEl = document.getElementById("legal-title");
  const updatedEl = document.getElementById("legal-updated");
  const bodyEl = document.getElementById("legal-body");

  const doc = LEGAL_DOCUMENTS[type];
  if (!dialog || !doc) return;

  if (titleEl) titleEl.textContent = doc.title;
  if (updatedEl) updatedEl.textContent = doc.updated;
  if (bodyEl) bodyEl.innerHTML = doc.html;

  openModalDialog(dialog, triggerEl);
}

export function initModals() {
  const lightboxDialog = document.getElementById("lightbox-dialog");
  const documentDialog = document.getElementById("document-dialog");

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dialog = btn.closest("dialog");
      if (dialog) closeModalDialog(dialog);
    });
  });

  const prevBtn = document.getElementById("lightbox-prev");
  const nextBtn = document.getElementById("lightbox-next");
  if (prevBtn) prevBtn.addEventListener("click", () => stepLightbox(-1));
  if (nextBtn) nextBtn.addEventListener("click", () => stepLightbox(1));

  document.addEventListener("keydown", (event) => {
    if (!lightboxDialog || !lightboxDialog.open) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepLightbox(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      stepLightbox(1);
    }
  });

  document.querySelectorAll("[data-open-resume]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      openResumeModal(btn);
    });
  });

  document.querySelectorAll("[data-open-legal]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      const legalType = btn.getAttribute("data-open-legal");
      openLegalModal(legalType, btn);
    });
  });

  if (documentDialog) {
    documentDialog.addEventListener("close", () => {
      const objectEl = document.getElementById("document-object");
      const frame = document.getElementById("document-frame");
      if (objectEl) objectEl.removeAttribute("data");
      if (frame) frame.src = "about:blank";
    });
  }
}
