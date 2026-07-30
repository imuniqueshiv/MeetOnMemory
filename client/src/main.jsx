// main.jsx
import React, { StrictMode } from "react"; // <-- Add 'React,' here
import { createRoot } from "react-dom/client";
import "./index.css";
import "./i18n.js";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import { AppContextProvider } from "./context/AppContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ClerkAuthProvider } from "./context/ClerkAuthProvider.jsx";
import { AssistantProvider } from "./context/AssistantContext.jsx";
import { registerSW } from "virtual:pwa-register";

registerSW({ immediate: true });

// Prevent FOUC by applying theme class before render
const savedTheme = localStorage.getItem("theme");
const systemPrefersDark = window.matchMedia(
  "(prefers-color-scheme: dark)",
).matches;
const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
if (initialTheme === "dark") {
  document.documentElement.classList.add("dark");
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ClerkAuthProvider>
      <ThemeProvider>
        <AppContextProvider>
          <AssistantProvider>
            <App />
          </AssistantProvider>
        </AppContextProvider>
      </ThemeProvider>
    </ClerkAuthProvider>
  </BrowserRouter>,
);
