import React, { useState, useEffect } from "react";
import { Languages, Loader2, Check } from "lucide-react";
import { translationApi } from "../../services/translationApi";

const TranslationSelector = ({
  meetingId,
  sourceType,
  onTranslate,
  isTranslating,
  setIsTranslating,
  currentLanguage,
  setCurrentLanguage,
}) => {
  const [languages, setLanguages] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const data = await translationApi.getSupportedLanguages();
        if (data.success) {
          setLanguages(data.languages);
        }
      } catch (error) {
        console.error("Failed to load languages:", error);
      }
    };
    fetchLanguages();
  }, []);

  const handleSelect = async (lang) => {
    setIsOpen(false);
    if (lang === currentLanguage) return;

    if (lang === "Original") {
      setCurrentLanguage("Original");
      onTranslate(null);
      return;
    }

    setIsTranslating(true);
    setCurrentLanguage(lang);
    try {
      const data = await translationApi.requestTranslation(
        meetingId,
        sourceType,
        lang,
      );
      if (data.success) {
        onTranslate(data.translatedContent);
      }
    } catch (error) {
      console.error("Translation failed:", error);
      setCurrentLanguage("Original");
      onTranslate(null);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isTranslating}
          className="inline-flex items-center justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
        >
          {isTranslating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-600" />
          ) : (
            <Languages className="mr-2 h-4 w-4 text-gray-500" />
          )}
          {currentLanguage === "Original" ? "Translate" : currentLanguage}
        </button>
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-0" onClick={() => setIsOpen(false)} />
          <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10 max-h-60 overflow-y-auto">
            <div className="py-1" role="menu" aria-orientation="vertical">
              <button
                onClick={() => handleSelect("Original")}
                className={`w-full text-left flex items-center px-4 py-2 text-sm ${
                  currentLanguage === "Original"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                role="menuitem"
              >
                {currentLanguage === "Original" && (
                  <Check className="mr-2 h-4 w-4" />
                )}
                <span className={currentLanguage === "Original" ? "" : "ml-6"}>
                  Original (English)
                </span>
              </button>
              <div className="border-t border-gray-100"></div>
              {languages.map((lang) => (
                <button
                  key={lang}
                  onClick={() => handleSelect(lang)}
                  className={`w-full text-left flex items-center px-4 py-2 text-sm ${
                    currentLanguage === lang
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  role="menuitem"
                >
                  {currentLanguage === lang && (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  <span className={currentLanguage === lang ? "" : "ml-6"}>
                    {lang}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TranslationSelector;
