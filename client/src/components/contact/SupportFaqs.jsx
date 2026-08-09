import React, { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";

export default function SupportFaqs({ filteredFaqs, searchQuery }) {
  const [expandedFaq, setExpandedFaq] = useState(null);

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex items-center gap-2.5">
        <HelpCircle className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-sm text-gray-950 dark:text-white">
          Support FAQs
        </h3>
      </div>

      <div className="space-y-2">
        {filteredFaqs.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-slate-500 py-4 text-center">
            No FAQ matches found for "{searchQuery}".
          </p>
        ) : (
          filteredFaqs.map((faq, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="border border-gray-100 dark:border-slate-700/60 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50/50 dark:bg-slate-700/10 hover:bg-gray-50 dark:hover:bg-slate-700/30 text-left transition duration-150"
                >
                  <span className="font-semibold text-xs text-gray-900 dark:text-white">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 shrink-0 ml-1 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="p-3 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700/60 text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
