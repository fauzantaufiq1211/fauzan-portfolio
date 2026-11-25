// MOTION 2 scroll-reveal observer; reveals each element once and skips motion when prefers-reduced-motion is set.
export function initScrollReveal(root = document, options = {}) {
  const selector = options.selector || ".reveal:not(.is-visible)";
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    root.querySelectorAll(selector).forEach((el) => {
      el.classList.add("is-visible");
    });
    return {
      observeNew(scope = document) {
        scope.querySelectorAll(selector).forEach((el) => {
          el.classList.add("is-visible");
        });
      },
      disconnect() {},
    };
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    },
    {
      threshold: options.threshold ?? 0.12,
      rootMargin: options.rootMargin ?? "0px 0px -40px 0px",
    },
  );

  function observeNew(scope = document) {
    scope.querySelectorAll(selector).forEach((el) => {
      observer.observe(el);
    });
  }

  observeNew(root);

  return {
    observeNew,
    disconnect() {
      observer.disconnect();
    },
  };
}

export default initScrollReveal;
