import React from "react";
import ReactDOM from "react-dom/client";

// Fonts are bundled so Nubby works fully offline (all SIL Open Font License).
import "@fontsource/patrick-hand";
import "@fontsource/kalam/400.css";
import "@fontsource/kalam/700.css";
import "@fontsource/gochi-hand";
import "@fontsource/caveat/500.css";
import "@fontsource/caveat/700.css";
import "@fontsource/shadows-into-light";
import "@fontsource/questrial";
import "@fontsource/eb-garamond/400.css";
import "@fontsource/eb-garamond/400-italic.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";

import "./styles/base.css";
import "./styles/shell.css";
import "./styles/page.css";
import "./styles/night.css";
import "./styles/v2.css";
import "./styles/print.css";

import App from "./App";
import { isMac } from "./lib/platform";
import { isTauri } from "./lib/storage";

// The Mac desktop app keeps its red/yellow/green window buttons over the top-left corner.
if (isMac && isTauri) document.documentElement.classList.add("mac-desktop");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Developer-only smoke test (stripped from release builds).
if (import.meta.env.DEV && new URLSearchParams(location.search).has("selftest")) {
  setTimeout(() => import("./selftest").then((m) => m.runSelfTest()), 1500);
}
