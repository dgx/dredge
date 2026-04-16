import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";

const dredgeDark = {
    dark: true,
    colors: {
        background: "#1a1a2e",
        surface: "#16213e",
        "surface-bright": "#0f3460",
        "surface-light": "#1a4080",
        "surface-variant": "#0d1b3e",
        "on-surface-variant": "#a0a0b0",
        primary: "#e94560",
        "primary-darken-1": "#c73a50",
        secondary: "#0f3460",
        error: "#e94560",
        info: "#0e68ab",
        success: "#4ade80",
        warning: "#fbbf24",
    },
    variables: {
        "border-color": "#2a2a4a",
        "border-opacity": 1,
        "high-emphasis-opacity": 1,
        "medium-emphasis-opacity": 0.72,
    },
};

export default createVuetify({
    theme: {
        defaultTheme: "dredgeDark",
        themes: { dredgeDark },
    },
    defaults: {
        VBtn: { variant: "tonal", density: "comfortable" },
        VTextField: { variant: "outlined", density: "compact", hideDetails: true },
        VSelect: { variant: "outlined", density: "compact", hideDetails: true },
        VTextarea: { variant: "outlined", hideDetails: true },
    },
});
