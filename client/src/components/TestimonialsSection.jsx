import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import apiClient from "../services/apiClient.js";
import TestimonialsCarousel from "./testimonials/TestimonialsCarousel.jsx";

const useIntersectionFade = (threshold = 0.15) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.unobserve(el);
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);
  return ref;
};

export default function TestimonialsSection() {
  const navigate = useNavigate();
  const headingRef = useIntersectionFade();
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data } = await apiClient.get("/api/testimonials/spotlight", {
          params: { limit: 12 },
        });
        if (!cancelled) {
          setTestimonials(data.testimonials || []);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load testimonials right now.");
          setTestimonials([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      id="testimonials"
      className="py-24 bg-white dark:bg-gray-900"
      aria-labelledby="testimonials-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">
        <div
          ref={headingRef}
          className="fade-in-up text-center max-w-3xl mx-auto mb-12"
        >
          <span className="inline-flex items-center px-4 py-1 rounded-full text-xs font-semibold tracking-wider uppercase bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
            Testimonials
          </span>
          <h2
            id="testimonials-heading"
            className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 mt-5 leading-tight"
          >
            Trusted by teams who{" "}
            <span className="bg-linear-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
              remember what matters
            </span>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
            Real feedback from people using MeetOnMemory to keep decisions and
            action items clear.
          </p>
        </div>

        {loading ? (
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            aria-busy="true"
            aria-label="Loading testimonials"
          >
            {[1, 2, 3].map((key) => (
              <div
                key={key}
                className="h-48 rounded-2xl border border-slate-200 dark:border-gray-700 bg-slate-100 dark:bg-gray-800 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-6 py-10 text-center text-sm text-rose-700 dark:text-rose-300">
            {error}
          </div>
        ) : (
          <TestimonialsCarousel testimonials={testimonials} />
        )}

        <div className="text-center mt-12">
          <button
            type="button"
            onClick={() => navigate("/testimonials")}
            className="group inline-flex items-center gap-2 px-8 py-3.5 bg-linear-to-r from-blue-600 to-violet-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-100 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer"
          >
            Share Your Experience
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
          </button>
        </div>
      </div>
    </section>
  );
}
