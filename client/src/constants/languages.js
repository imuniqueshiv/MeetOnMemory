// Single source of truth for supported UI languages.
// Add a language here (and its resource in i18n.js / locales/*.json) and it
// automatically shows up in both the Navbar LanguageSwitcher and Settings.
export const LANGUAGES = [
  { code: "en", label: "EN", name: "English", flag: "🌐" },
  { code: "hi", label: "हिंदी", name: "Hindi", flag: "🇮🇳" },
  { code: "ar", label: "العربية", name: "Arabic", flag: "🇸🇦" },
];

export const DEFAULT_LANGUAGE = "en";
