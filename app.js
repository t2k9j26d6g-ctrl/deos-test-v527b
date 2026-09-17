/* ==========================================================================
   DEOS — Identification automatique TEST / PROD
   Patch autonome : peut rester dans le même app.js en TEST puis en PROD.
   L'environnement est déduit de l'URL.
   ========================================================================== */
(() => {
  "use strict";

  const pathname = String(window.location.pathname || "").toLowerCase();
  const hostname = String(window.location.hostname || "").toLowerCase();

  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");

  const isTest =
    pathname.includes("/deos-test") ||
    pathname.includes("deos-test-") ||
    isLocal;

  const ENV = isTest ? "TEST" : "PROD";
  const COLOR = isTest ? "#f59e0b" : "#2563eb";
  const BG = isTest ? "#fff7ed" : "#eff6ff";
  const TEXT = isTest ? "#9a3412" : "#1e3a8a";

  window.DEOS_ENVIRONMENT = ENV;
  document.documentElement.dataset.deosEnvironment = ENV;

  function setOrCreateMeta(name, content) {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function setIdentity() {
    // Onglet navigateur + nom proposé lors de l'ajout à l'écran d'accueil.
    document.title = ENV === "TEST" ? "DEOS TEST" : "DEOS";
    setOrCreateMeta(
      "apple-mobile-web-app-title",
      ENV === "TEST" ? "DEOS TEST" : "DEOS"
    );
    setOrCreateMeta(
      "application-name",
      ENV === "TEST" ? "DEOS TEST" : "DEOS"
    );

    // Favicon autonome, distinct selon l'environnement.
    const label = ENV === "TEST" ? "T" : "D";
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="14" fill="${COLOR}"/>` +
      `<text x="32" y="43" text-anchor="middle" font-family="Arial,sans-serif" ` +
      `font-size="36" font-weight="700" fill="white">${label}</text></svg>`;

    let favicon = document.querySelector('link[rel~="icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.href = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function injectStyle() {
    if (document.getElementById("deos-environment-style")) return;

    const style = document.createElement("style");
    style.id = "deos-environment-style";
    style.textContent = `
      #deos-environment-marker {
        position: fixed;
        z-index: 2147483646;
        top: max(6px, env(safe-area-inset-top));
        right: 8px;
        border: 1px solid ${COLOR};
        background: ${BG};
        color: ${TEXT};
        border-radius: 999px;
        padding: 5px 10px;
        font: 800 11px/1.15 -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
        letter-spacing: .05em;
        box-shadow: 0 2px 8px rgba(0,0,0,.12);
        pointer-events: none;
        user-select: none;
      }

      html[data-deos-environment="TEST"]::before {
        content: "";
        position: fixed;
        z-index: 2147483645;
        left: 0;
        top: 0;
        width: 100%;
        height: 4px;
        background: ${COLOR};
        pointer-events: none;
      }

      @media (max-width: 640px) {
        #deos-environment-marker {
          top: max(5px, env(safe-area-inset-top));
          right: 5px;
          padding: 4px 8px;
          font-size: 10px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function injectMarker() {
    let marker = document.getElementById("deos-environment-marker");
    if (!marker) {
      marker = document.createElement("div");
      marker.id = "deos-environment-marker";
      marker.setAttribute("aria-hidden", "true");
      document.body.appendChild(marker);
    }
    marker.textContent = ENV === "TEST" ? "DEOS TEST" : "DEOS PROD";
    marker.title =
      ENV === "TEST"
        ? "Environnement de test"
        : "Environnement de production";
  }

  // Corrige aussi un ancien libellé MODE TEST / MODE PROD éventuellement
  // conservé par le code ou un état local.
  function normalizeVisibleModeLabels() {
    const wanted = ENV === "TEST" ? "MODE TEST" : "MODE PROD";
    const unwanted = ENV === "TEST" ? "MODE PROD" : "MODE TEST";

    document.querySelectorAll("body *").forEach((el) => {
      if (el.children.length !== 0) return;
      const txt = el.textContent;
      if (!txt || !txt.includes(unwanted)) return;
      el.textContent = txt.replaceAll(unwanted, wanted);
    });
  }

  let scheduled = false;
  function scheduleNormalize() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      normalizeVisibleModeLabels();
      injectMarker();
    });
  }

  function init() {
    setIdentity();
    injectStyle();
    injectMarker();
    normalizeVisibleModeLabels();

    const observer = new MutationObserver(scheduleNormalize);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
