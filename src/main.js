import { createApp } from "vue";
import { createPinia } from "pinia";
import { installBrowserFallback } from "./services/browserFallback";
import vuetify from "./plugins/vuetify";
import App from "./App.vue";
import "mana-font/css/mana.min.css";
import "./styles/main.css";

installBrowserFallback();

const app = createApp(App);
app.use(createPinia());
app.use(vuetify);
app.mount("#app");
