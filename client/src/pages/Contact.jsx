import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import { LifeBuoy, Search } from "lucide-react";
import useContactForm from "../hooks/useContactForm";
import useLiveChat from "../hooks/useLiveChat";
import ContactForm from "../components/contact/ContactForm";
import LiveChatWidget from "../components/contact/LiveChatWidget";
import SupportFaqs from "../components/contact/SupportFaqs";
import LocationCards from "../components/contact/LocationCards";

// Support FAQs data
const faqs = [
  {
    q: "How can I change my billing or upgrade my transcription limit?",
    a: "Organization owners can manage subscriptions directly under the Organization Settings > Billing panel. You can select higher tiers or purchase additional top-up AI credits using a credit card.",
  },
  {
    q: "How do I request a custom DPA or SOC 2 report?",
    a: "Enterprise subscribers can contact our security team at security@meetonmemory.com. We can share standard Data Processing Addendums (DPA) and audit compliance documents upon verification.",
  },
  {
    q: "What audio formats does the meeting transcription service support?",
    a: "We support MP3, MP4, WAV, M4A, AAC, and WEBM file formats. The maximum single-file upload size is 250MB for standard accounts and 1GB for enterprise accounts.",
  },
  {
    q: "Can I host a self-hosted or on-premise instance of MeetOnMemory?",
    a: "Currently, we operate as a fully managed SaaS cloud service to maintain stable vector databases and API integrations. Contact sales@meetonmemory.com if you have strict dedicated-tenant hosting requirements.",
  },
];

// Locations data
const locations = [
  {
    city: "San Francisco",
    address: "548 Market St, Suite 4839, San Francisco, CA 94104",
    phone: "+1 (415) 890-3450",
    email: "sf@meetonmemory.com",
    hours: "9:00 AM - 6:00 PM PST",
  },
  {
    city: "Mumbai",
    address: "Godrej Coliseum, Behind Everard Nagar, Sion, Mumbai 400022",
    phone: "+91 22 6789 0122",
    email: "mumbai@meetonmemory.com",
    hours: "9:30 AM - 6:30 PM IST",
  },
];

const Contact = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const {
    formData,
    setFormData,
    submittedTicket,
    setSubmittedTicket,
    submitting,
    handleFormSubmit,
  } = useContactForm();

  const {
    chatInput,
    setChatInput,
    chatMessages,
    botTyping,
    chatEndRef,
    handleSendMessage,
  } = useLiveChat();

  // Filter FAQs based on search query
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const query = searchQuery.toLowerCase();
    return faqs.filter(
      (faq) =>
        faq.q.toLowerCase().includes(query) ||
        faq.a.toLowerCase().includes(query),
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 flex flex-col">
      <Navbar />

      {/* Hero Header */}
      <header className="relative overflow-hidden bg-linear-to-br from-blue-50 via-white to-violet-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border-b border-gray-100 dark:border-slate-800 pt-28 pb-16">
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-blue-300 dark:bg-blue-900/30 blur-3xl animate-blob" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-violet-300 dark:bg-violet-900/20 blur-3xl animate-blob animation-delay-2000" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100/80 dark:bg-blue-950/50 border border-blue-200/50 dark:border-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-semibold uppercase tracking-wider mb-4 animate-fade-in">
            <LifeBuoy className="w-3.5 h-3.5" /> Help & Support
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight leading-tight">
            Contact Support
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-base sm:text-lg text-gray-500 dark:text-slate-400">
            Have questions about billing, security keys, transcript uploads, or
            API rate boundaries? We are here to help.
          </p>

          <div className="mt-8 max-w-md mx-auto relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400 dark:text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Search help topics, tutorials, FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-4 py-3 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition shadow-sm text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Contact Form & Ticket Output */}
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xs">
              <ContactForm
                formData={formData}
                setFormData={setFormData}
                submittedTicket={submittedTicket}
                setSubmittedTicket={setSubmittedTicket}
                submitting={submitting}
                handleFormSubmit={handleFormSubmit}
              />
            </div>

            {/* Location Cards */}
            <LocationCards locations={locations} />
          </div>

          {/* Right Column: Live Chat Bot & Support FAQs */}
          <div className="lg:col-span-5 space-y-8">
            {/* Live Chat Simulator Box */}
            <LiveChatWidget
              chatInput={chatInput}
              setChatInput={setChatInput}
              chatMessages={chatMessages}
              botTyping={botTyping}
              chatEndRef={chatEndRef}
              handleSendMessage={handleSendMessage}
            />

            {/* Support FAQs */}
            <SupportFaqs
              filteredFaqs={filteredFaqs}
              searchQuery={searchQuery}
            />
          </div>
        </div>
      </main>

      {/* Back to Home bottom bar */}
      <div className="bg-gray-100 dark:bg-slate-900 border-t border-gray-200/80 dark:border-slate-800/80 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">
            Want to schedule a custom system integration tutorial?
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs font-semibold">
            <a
              href="mailto:support@meetonmemory.com"
              className="px-4 py-2 border border-gray-200 dark:border-slate-800 rounded-lg text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition"
            >
              Request Enterprise Demo
            </a>
            <Link
              to="/"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
