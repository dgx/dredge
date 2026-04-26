import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import { createVuetify } from "vuetify";

// Palette: aged leather + arcane gold. Built around the Cinzel-gold titlebar
// and section headers — primary is the same brand gold so accents stay coherent.
const dredgeDark = {
    dark: true,
    colors: {
        background: "#15110d",
        surface: "#1f1813",
        "surface-bright": "#2c2218",
        "surface-light": "#3a2d1f",
        "surface-variant": "#1a140f",
        "on-background": "#e8dcc4",
        "on-surface": "#e8dcc4",
        "on-surface-variant": "#a89880",
        primary: "#c9a14a",
        "primary-darken-1": "#a9842f",
        "on-primary": "#1a1208",
        secondary: "#7a3a3a",
        "on-secondary": "#f4e4d4",
        error: "#c44545",
        info: "#5a8aa8",
        success: "#6a9955",
        warning: "#d4a04a",
    },
    variables: {
        "border-color": "#3a2d1f",
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
