import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider } from "react-i18next";
import { defineElement } from "@lordicon/element";

import "./theme/globalFonts.css";
import i18n from "./i18n/i18n";
import App from "./App";

defineElement();

const container = document.getElementById("root");

if (!container) {
  throw new Error(
    "[NyayaSetu] Root element #root not found. Check public/index.html.",
  );
}

const root = createRoot(container);

root.render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <App />
    </I18nextProvider>
  </StrictMode>,
);
