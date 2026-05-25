import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mountWithVuetify } from "../helpers/mount.js";
import App from "../../src/App.vue";

// App.vue pulls in the whole view tree and touches window.electronAPI on
// mount. We stub the heavy children (but keep AboutDialog real) so the test
// stays focused on the titlebar chrome that always renders before cards.loaded.
const childStubs = {
    SearchBar: true,
    CardGrid: true,
    CardDetail: true,
    DeckBuilder: true,
    PackSetup: true,
    PackOpener: true,
    WelcomeOverlay: true,
};

describe("App.vue", () => {
    beforeEach(() => {
        // No onUpdateEvent → update gate skips; no loadCardDatabase usage here.
        window.electronAPI = undefined;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete window.electronAPI;
    });

    it("opens the About dialog with the app version when the title is clicked", async () => {
        const wrapper = mountWithVuetify(App, {
            global: { stubs: childStubs },
        });

        // Dialog teleports to body; nothing rendered until the title is clicked.
        expect(document.body.querySelector(".about-card")).toBeNull();

        await wrapper.find(".titlebar-text").trigger("click");
        await new Promise((r) => setTimeout(r, 0));

        const card = document.body.querySelector(".about-card");
        expect(card).not.toBeNull();
        // Version is injected via the Vite/Vitest __APP_VERSION__ define.
        expect(card.querySelector(".about-version").textContent).toContain("0.0.0-test");
    });
});
