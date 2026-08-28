import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import hi from "./locales/hi.json";
import ar from "./locales/ar.json";
import { LANGUAGES, DEFAULT_LANGUAGE } from "./constants/languages.js";

const RTL_LANGUAGES = ["ar", "he", "fa", "ur"];

const updateDocDirection = (lng) => {
  if (typeof document !== "undefined") {
    const isRtl = RTL_LANGUAGES.includes(lng);
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = lng;
  }
};

// Same pattern as getInitialTheme() in ThemeContext.jsx: read a saved
// preference synchronously so there's no flash of the wrong language.
// Falls back to the default if localStorage holds a code we don't
// actually have translation resources for.
const getInitialLanguage = () => {
  const saved = localStorage.getItem("language");
  const isSupported = LANGUAGES.some((lang) => lang.code === saved);
  const initialLng = isSupported ? saved : DEFAULT_LANGUAGE;
  // Apply direction synchronously before mount
  updateDocDirection(initialLng);
  return initialLng;
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    ar: { translation: ar },
  },
  lng: getInitialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false, // React already handles XSS
  },
});

// Persist on every language change, no matter what triggered it
// (Navbar LanguageSwitcher, Settings page, etc). This is what makes the
// language choice survive a page refresh.
i18n.on("languageChanged", (lng) => {
  localStorage.setItem("language", lng);
  updateDocDirection(lng);
});

export default i18n;
