import React, { useState, useEffect, useRef } from "react";
import { LayoutTemplate, ChevronDown, Check } from "lucide-react";
import { useMeetingNoteTemplates } from "../../hooks/useMeetingNoteTemplates";

const NoteTemplateSelector = ({ onApplyTemplate, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { templates, isLoading, fetchTemplates, applyTemplate } =
    useMeetingNoteTemplates();

  useEffect(() => {
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen, fetchTemplates]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleApply = async (templateId) => {
    const markdown = await applyTemplate(templateId);
    if (markdown) {
      onApplyTemplate(markdown);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Apply Note Template"
      >
        <LayoutTemplate className="w-3.5 h-3.5" />
        Templates
        <ChevronDown className="w-3.5 h-3.5 opacity-70" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-200 dark:border-gray-700">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
              Note Templates
            </h3>
          </div>
          <div className="py-1 max-h-60 overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                No templates found.
              </div>
            ) : (
              templates.map((template) => (
                <button
                  key={template._id}
                  onClick={() => handleApply(template._id)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between group"
                >
                  <div className="flex flex-col">
                    <span className="font-medium truncate">
                      {template.name}
                    </span>
                    {template.description && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {template.description}
                      </span>
                    )}
                  </div>
                  <Check className="w-4 h-4 opacity-0 group-hover:opacity-100 text-indigo-600 dark:text-indigo-400 transition-opacity" />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteTemplateSelector;
