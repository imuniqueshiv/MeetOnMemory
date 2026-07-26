import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";


const FAQItem = ({ faq, index, isOpen, onClick }) => {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stagger = `stagger-${Math.min((index % 6) + 1, 6)}`;

  return (
    <div
      ref={ref}
      className={`fade-in-up ${stagger} rounded-2xl border transition-all duration-300 ${
        isOpen
          ? "border-blue-200 dark:border-blue-600 shadow-md shadow-blue-500/10 bg-white dark:bg-gray-800"
          : "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-200 dark:hover:border-blue-600 hover:shadow-md"
      }`}
    >
      <button
        className="flex w-full items-center justify-between px-6 py-5 text-left focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl"
        onClick={onClick}
        aria-expanded={isOpen}
        aria-controls={`faq-answer-${index}`}
        id={`faq-btn-${index}`}
      >
        <span className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 pr-4">
          {faq.question}
        </span>

        <ChevronDown
          aria-hidden="true"
          className={`h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <div
        id={`faq-answer-${index}`}
        role="region"
        aria-labelledby={`faq-btn-${index}`}
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-6 text-gray-600 dark:text-gray-300 leading-7 text-sm sm:text-base">
            {faq.answer}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(-1);
  const navigate = useNavigate();
  const headingRef = useRef(null);
  const { t } = useTranslation();

  const faqs = [
    {
      question: t("faq.q1"),
      answer: t("faq.a1"),
    },
    {
      question: t("faq.q2"),
      answer: t("faq.a2"),
    },
    {
      question: t("faq.q3"),
      answer: t("faq.a3"),
    },
    {
      question: t("faq.q4"),
      answer: t("faq.a4"),
    },
    {
      question: t("faq.q5"),
      answer: t("faq.a5"),
    },
    {
      question: t("faq.q6"),
      answer: t("faq.a6"),
    },
    {
      question: t("faq.q7"),
      answer: t("faq.a7"),
    },
    {
      question: t("faq.q8"),
      answer: t("faq.a8"),
    },
  ];

  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="faq"
      className="relative overflow-hidden py-24 px-4 sm:px-6 bg-linear-to-b from-white via-slate-50 to-white dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"
    >
      <div className="max-w-3xl mx-auto">
        {/* Heading */}
        <div ref={headingRef} className="fade-in-up text-center mb-14">
          <span className="inline-flex rounded-full border border-blue-200 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/30 px-4 py-1 text-xs font-semibold tracking-wider uppercase text-blue-700 dark:text-blue-300">
            {t("faq.badge")}
          </span>

          <h2 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            {t("faq.heading")}
          </h2>

          <p className="mt-4 text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-base leading-relaxed">
            {t("faq.subtitle")}
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-3">
          {faqs.map((faq, index) => (
            <FAQItem
              key={faq.question}
              faq={faq}
              index={index}
              isOpen={openIndex === index}
              onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
            />
          ))}
        </div>

        {/* CTA below FAQ */}
        <div className="mt-14 text-center p-8 rounded-2xl bg-linear-to-br from-blue-50 to-violet-50 dark:from-blue-900/20 dark:to-violet-900/20 border border-blue-100 dark:border-blue-800">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t("faq.stillHaveQuestions")}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
            {t("faq.trySelf")}
          </p>
          <button
            id="faq-cta-btn"
            onClick={() => navigate("/login?mode=signup")}
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-linear-to-r from-blue-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-100 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            aria-label="Get started with MeetOnMemory for free"
          >
            {t("faq.getStartedFree")}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      </div>
    </section>
  );
}
