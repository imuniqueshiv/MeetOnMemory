import React, { useState } from "react";

const terms = [
  { term: "API", definition: "Application Programming Interface" },
  { term: "UI", definition: "User Interface" },
  { term: "UX", definition: "User Experience" },
];

const Glossary = () => {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const handleToggle = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggle(index);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Glossary
      </h2>
      <div className="space-y-2">
        {terms.map((item, index) => {
          const isExpanded = expandedIndex === index;
          return (
            <div
              key={index}
              className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden"
            >
              <div
                className="w-full text-left px-4 py-3 bg-gray-50 dark:bg-slate-800 font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 transition-shadow"
                tabIndex={0}
                role="button"
                aria-expanded={isExpanded}
                aria-controls={`glossary-desc-${index}`}
                aria-label={`Toggle definition for ${item.term}`}
                onClick={() => handleToggle(index)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              >
                {item.term}
              </div>
              {isExpanded && (
                <div
                  id={`glossary-desc-${index}`}
                  role="region"
                  className="px-4 py-3 bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300"
                >
                  {item.definition}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Glossary;
