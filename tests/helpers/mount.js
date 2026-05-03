import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

let cachedVuetify = null;
function getVuetify() {
    if (!cachedVuetify) cachedVuetify = createVuetify({ components, directives });
    return cachedVuetify;
}

// Mount a component with Vuetify + Pinia. Returns the wrapper and the active pinia.
export function mountWithVuetify(Component, options = {}) {
    const pinia = createPinia();
    setActivePinia(pinia);
    return mount(Component, {
        ...options,
        global: {
            plugins: [getVuetify(), pinia, ...(options.global?.plugins ?? [])],
            stubs: options.global?.stubs ?? {},
            mocks: options.global?.mocks ?? {},
        },
        attachTo: options.attachTo ?? document.body,
    });
}

export { mount };
