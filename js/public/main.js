import { initScrollReveal } from "../utils/observer.js";
import { initContactForm } from "./contact-form.js";
import { initModals } from "./modal-lightbox.js";
import { initPortfolio } from "./render-portfolio.js";
import { initProfile } from "./render-profile.js";

function initNavigation() {
  const siteHeader = document.querySelector(".site-header");
  const toggleBtn = document.getElementById("nav-toggle");
  const navMenu = document.getElementById("nav-menu");
  const navLinks = document.querySelectorAll(".nav-link[href^='#']");

  function syncNavbarScrollState() {
    if (!siteHeader) return;
    siteHeader.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  syncNavbarScrollState();
  window.addEventListener("scroll", syncNavbarScrollState, { passive: true });

  function closeMobileMenu() {
    if (!toggleBtn || !navMenu) return;
    navMenu.setAttribute("data-open", "false");
    toggleBtn.setAttribute("aria-expanded", "false");
  }

  if (toggleBtn && navMenu) {
    toggleBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const isOpen = navMenu.getAttribute("data-open") === "true";
      navMenu.setAttribute("data-open", String(!isOpen));
      toggleBtn.setAttribute("aria-expanded", String(!isOpen));
    });

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        navMenu.getAttribute("data-open") === "true"
      ) {
        closeMobileMenu();
        toggleBtn.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (
        navMenu.getAttribute("data-open") === "true" &&
        siteHeader &&
        !siteHeader.contains(event.target)
      ) {
        closeMobileMenu();
      }
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      closeMobileMenu();
    });
  });

  const resumeBtn = navMenu?.querySelector("[data-open-resume]");
  resumeBtn?.addEventListener("click", () => {
    closeMobileMenu();
  });

  if ("IntersectionObserver" in window) {
    const sections = Array.from(navLinks)
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);

    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = `#${entry.target.id}`;
          navLinks.forEach((link) => {
            const isMatch = link.getAttribute("href") === id;
            link.classList.toggle("is-active", isMatch);
            if (isMatch) {
              link.setAttribute("aria-current", "true");
            } else {
              link.removeAttribute("aria-current");
            }
          });
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0 },
    );

    sections.forEach((section) => navObserver.observe(section));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const revealController = initScrollReveal(document);
  initNavigation();
  initModals();
  initContactForm();
  initPortfolio(revealController);
  initProfile(revealController);
});
