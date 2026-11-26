import { supabase } from "../config/supabase-client.js";
import { escapeHtml } from "../utils/dom.js";

// Restrict client-side admin workspace entry to the single active Supabase Auth administrator.
export const ALLOWED_ADMIN_EMAILS = new Set(["admin@fauzantaufiq.id"]);

const AUTH_ICONS = {
  error: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  `,
  success: `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  `,
};

function renderAuthStatus(statusEl, type, title, detail = "") {
  if (!statusEl) return;
  statusEl.className = `form-status form-status--${type}`;
  statusEl.setAttribute("role", type === "error" ? "alert" : "status");
  statusEl.innerHTML = `
    <span class="form-status-icon">${AUTH_ICONS[type] || ""}</span>
    <div class="form-status-copy">
      <p class="text-body-sm"><strong>${escapeHtml(title)}</strong></p>
      ${detail ? `<p class="text-caption">${escapeHtml(detail)}</p>` : ""}
    </div>
  `;
  statusEl.hidden = false;
}

export function initAuth({ onAuthenticated, onSignedOut } = {}) {
  const loginForm = document.getElementById("login-form");
  const emailInput = document.getElementById("login-email");
  const passwordInput = document.getElementById("login-password");
  const togglePwdBtn = document.getElementById("toggle-password-btn");
  const signInBtn = document.getElementById("login-submit-btn");
  const magicLinkBtn = document.getElementById("magic-link-btn");
  const statusEl = document.getElementById("auth-status");
  const logoutBtns = document.querySelectorAll("[data-admin-logout]");

  async function enforceAllowedAdmin(user) {
    const normalizedEmail = String(user?.email || "").trim().toLowerCase();
    if (ALLOWED_ADMIN_EMAILS.has(normalizedEmail)) {
      if (typeof onAuthenticated === "function") onAuthenticated(user);
      return true;
    }

    await supabase.auth.signOut();
    renderAuthStatus(
      statusEl,
      "error",
      "Access denied",
      "This account is not permitted to access the Portfolio Admin Workspace.",
    );
    if (typeof onSignedOut === "function") onSignedOut();
    return false;
  }

  if (togglePwdBtn && passwordInput) {
    togglePwdBtn.addEventListener("click", () => {
      const isHidden = passwordInput.type === "password";
      passwordInput.type = isHidden ? "text" : "password";
      togglePwdBtn.setAttribute("aria-pressed", String(isHidden));
      togglePwdBtn.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password",
      );
      togglePwdBtn.textContent = isHidden ? "Hide" : "Show";
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (statusEl) statusEl.hidden = true;

      const email = (emailInput?.value || "").trim();
      const password = passwordInput?.value || "";

      if (!email || !password) {
        renderAuthStatus(
          statusEl,
          "error",
          "Missing credentials",
          "Enter both your admin email address and password to sign in.",
        );
        return;
      }

      if (signInBtn) {
        signInBtn.disabled = true;
        signInBtn.textContent = "Signing in...";
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        if (data?.user) {
          await enforceAllowedAdmin(data.user);
        }
      } catch (error) {
        renderAuthStatus(
          statusEl,
          "error",
          "Sign-in failed",
          error?.message || "Verify your email and password and try again.",
        );
      } finally {
        if (signInBtn) {
          signInBtn.disabled = false;
          signInBtn.textContent = "Sign In with Password";
        }
      }
    });
  }

  // Preserves window.location.href as emailRedirectTo so both /admin and /admin.html rewrites work.
  if (magicLinkBtn) {
    magicLinkBtn.addEventListener("click", async () => {
      if (statusEl) statusEl.hidden = true;
      const email = (emailInput?.value || "").trim();
      if (!email) {
        renderAuthStatus(
          statusEl,
          "error",
          "Email address required",
          "Enter your admin email address above before requesting a Magic Link.",
        );
        emailInput?.focus();
        return;
      }

      magicLinkBtn.disabled = true;
      magicLinkBtn.textContent = "Sending Magic Link...";

      try {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.href },
        });
        if (error) throw error;

        renderAuthStatus(
          statusEl,
          "success",
          "Magic Link sent",
          `Check ${email} for your single-use sign-in link.`,
        );
        magicLinkBtn.textContent = "Resend Magic Link";
      } catch (error) {
        renderAuthStatus(
          statusEl,
          "error",
          "Unable to send Magic Link",
          error?.message || "Please try again or sign in with your password.",
        );
        magicLinkBtn.textContent = "Send Magic Link";
      } finally {
        magicLinkBtn.disabled = false;
      }
    });
  }

  logoutBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      await supabase.auth.signOut();
      if (loginForm) loginForm.reset();
      if (statusEl) statusEl.hidden = true;
      if (typeof onSignedOut === "function") onSignedOut();
    });
  });

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      await enforceAllowedAdmin(session.user);
    } else if (event === "SIGNED_OUT") {
      if (typeof onSignedOut === "function") onSignedOut();
    }
  });

  supabase.auth.getSession().then(async ({ data }) => {
    if (data?.session?.user) {
      await enforceAllowedAdmin(data.session.user);
    } else if (typeof onSignedOut === "function") {
      onSignedOut();
    }
  });
}
