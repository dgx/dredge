// Polyfills and globals for component tests running under happy-dom.

if (typeof globalThis.IntersectionObserver === "undefined") {
    globalThis.IntersectionObserver = class IntersectionObserver {
        constructor(cb) {
            this.cb = cb;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
            return [];
        }
    };
}

if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
}

// Vuetify expects window.matchMedia (display breakpoints).
if (typeof window !== "undefined" && !window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}

// Vuetify component templates use CSS.supports() and getComputedStyle.
if (typeof window !== "undefined" && !window.CSS) {
    window.CSS = { supports: () => false };
}

// Vuetify VOverlay/VDialog read window.visualViewport for positioning.
if (typeof window !== "undefined" && !window.visualViewport) {
    const vv = {
        width: 1024,
        height: 768,
        offsetLeft: 0,
        offsetTop: 0,
        pageLeft: 0,
        pageTop: 0,
        scale: 1,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    };
    window.visualViewport = vv;
    globalThis.visualViewport = vv;
}

// Suppress Vuetify dev-only warnings/info during tests; keep errors.
const origWarn = console.warn;
console.warn = (...args) => {
    const msg = String(args[0] || "");
    if (msg.includes("[Vuetify]")) return;
    origWarn.apply(console, args);
};
