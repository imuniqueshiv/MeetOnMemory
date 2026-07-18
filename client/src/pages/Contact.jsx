import React, { useState, useEffect, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar.jsx";
import {
  Mail,
  MessageSquare,
  MapPin,
  Clock,
  Phone,
  Send,
  User,
  Building,
  Info,
  Check,
  ChevronDown,
  HelpCircle,
  Search,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Ticket,
  LifeBuoy
} from "lucide-react";

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
  const [expandedFaq, setExpandedFaq] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    org: "",
    subject: "",
    department: "support",
    message: "",
  });
  const [submittedTicket, setSubmittedTicket] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Live Chat Simulator State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { sender: "bot", text: "Hello! I am your MeetOnMemory virtual assistant. How can I help you today?", time: "Just now" },
  ]);
  const [botTyping, setBotTyping] = useState(false);
  const chatEndRef = useRef(null);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, botTyping]);

  // Filter FAQs based on search query
  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) return faqs;
    const query = searchQuery.toLowerCase();
    return faqs.filter(
      (faq) =>
        faq.q.toLowerCase().includes(query) ||
        faq.a.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Handle Form Submit
  const handleFormSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      const ticketId = "MOM-" + Math.floor(100000 + Math.random() * 900000);
      setSubmittedTicket({
        id: ticketId,
        name: formData.name,
        email: formData.email,
        department: formData.department,
        subject: formData.subject,
        date: new Date().toLocaleString(),
        status: "Open / Queued",
        sla: formData.department === "sales" ? "Within 4 hours" : "Within 12 hours",
      });
      setSubmitting(false);
      // Clear form
      setFormData({
        name: "",
        email: "",
        org: "",
        subject: "",
        department: "support",
        message: "",
      });
    }, 1500);
  };

  // Handle Chatbot Reply logic
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    const timeStr = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    
    // Append User Message
    setChatMessages((prev) => [...prev, { sender: "user", text: userText, time: timeStr }]);
    setChatInput("");
    setBotTyping(true);

    // Bot Auto-reply logic
    setTimeout(() => {
      let replyText = "Thank you for your message. Our team will read this and get back to you shortly. Feel free to submit a formal support ticket using the contact form.";
      const query = userText.toLowerCase();

      if (query.includes("hello") || query.includes("hi ") || query.includes("hey")) {
        replyText = "Hello! Hope you are having a great day. How can I assist you with MeetOnMemory?";
      } else if (query.includes("pricing") || query.includes("cost") || query.includes("plan") || query.includes("credit")) {
        replyText = "We offer free and premium tiers. You can view rates and purchase AI credits under the Settings > Billing panel inside your account dashboard.";
      } else if (query.includes("gemini") || query.includes("ai model") || query.includes("training")) {
        replyText = "We use secure Google Gemini APIs under a zero-retention developer policy. Your meeting transcripts and organizational data are never used for model training.";
      } else if (query.includes("delete") || query.includes("retention") || query.includes("purge")) {
        replyText = "You can permanently delete transcripts or workspaces at any time. Deleting files purges their data from MongoDB storage and deletes vector records from Pinecone.";
      } else if (query.includes("error") || query.includes("fail") || query.includes("bug")) {
        replyText = "I'm sorry to hear that! Please file a support ticket using our form, or write directly to support@meetonmemory.com so we can investigate the server logs.";
      }

      setChatMessages((prev) => [...prev, { sender: "bot", text: replyText, time: timeStr }]);
      setBotTyping(false);
    }, 1000);
  };

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
            Have questions about billing, security keys, transcript uploads, or API rate boundaries? We are here to help.
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
              
              {!submittedTicket ? (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Send Us a Message</h2>
                      <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Submit your request below and we will route it to the correct desk.</p>
                    </div>
                  </div>

                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Your Name</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <User className="h-4 w-4 text-gray-400" />
                          </span>
                          <input
                            type="text"
                            required
                            placeholder="Jane Doe"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Mail className="h-4 w-4 text-gray-400" />
                          </span>
                          <input
                            type="email"
                            required
                            placeholder="jane@company.com"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Organization</label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Building className="h-4 w-4 text-gray-400" />
                          </span>
                          <input
                            type="text"
                            placeholder="e.g. Acme Corp (Optional)"
                            value={formData.org}
                            onChange={(e) => setFormData({ ...formData, org: e.target.value })}
                            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Department</label>
                        <select
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        >
                          <option value="support">Technical Support</option>
                          <option value="sales">Sales & Enterprise</option>
                          <option value="billing">Billing & Subscriptions</option>
                          <option value="security">Security Vulnerability</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Subject</label>
                      <input
                        type="text"
                        required
                        placeholder="Summarize the support request..."
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">Message Details</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Provide details of your question or issue, including relevant meeting dates or transcription IDs..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                    >
                      {submitting ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> Submitting Request...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" /> Submit Support Request
                        </>
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="p-4 sm:p-6 border-2 border-dashed border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/10 rounded-2xl space-y-6 text-center animate-fade-in">
                  <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
                    <Ticket className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl text-gray-900 dark:text-white">Support Ticket Issued</h3>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Our support systems have registered your request. Write down your ticket tracking UUID.</p>
                  </div>

                  <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl p-4 text-left text-xs sm:text-sm space-y-3.5 shadow-xs">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-slate-800">
                      <span className="text-gray-400 font-medium">Ticket ID</span>
                      <span className="font-extrabold text-blue-600 dark:text-blue-400 tracking-wider font-mono">{submittedTicket.id}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-400 font-medium">Recipient</span>
                        <p className="font-bold text-gray-800 dark:text-slate-300 mt-0.5 truncate">{submittedTicket.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 font-medium">Department</span>
                        <p className="font-bold text-gray-800 dark:text-slate-300 mt-0.5 capitalize">{submittedTicket.department}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 font-medium">SLA Resolution</span>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{submittedTicket.sla}</p>
                      </div>
                      <div>
                        <span className="text-gray-400 font-medium">Ticket Status</span>
                        <p className="font-bold text-gray-800 dark:text-slate-300 mt-0.5">{submittedTicket.status}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-50 dark:border-slate-800">
                      <span className="text-gray-400 font-medium">Subject</span>
                      <p className="font-semibold text-gray-700 dark:text-slate-300 mt-0.5 truncate">{submittedTicket.subject}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      onClick={() => setSubmittedTicket(null)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition shadow-sm"
                    >
                      Submit Another Ticket
                    </button>
                    <button
                      onClick={() => document.querySelector(".live-chat-widget")?.scrollIntoView({ behavior: "smooth" })}
                      className="px-4 py-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-semibold text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
                    >
                      Ask Live Assistant
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Location Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {locations.map((loc) => (
                <div key={loc.city} className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
                  <h4 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-500" /> {loc.city} Office
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 leading-relaxed">{loc.address}</p>
                  
                  <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-700/60 space-y-2 text-xs font-semibold">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                      <Phone className="w-3.5 h-3.5 text-gray-400" /> {loc.phone}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                      <Mail className="w-3.5 h-3.5 text-gray-400" /> {loc.email}
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-gray-400" /> {loc.hours}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Live Chat Bot & Support FAQs */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Live Chat Simulator Box */}
            <div className="live-chat-widget bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col max-h-[460px]">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-700/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <div>
                    <h3 className="font-bold text-sm text-gray-950 dark:text-white">Live Support Assistant</h3>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500">Automated Bot Reply System</p>
                  </div>
                </div>
                <div className="p-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>

              {/* Chat Log container */}
              <div className="flex-1 overflow-y-auto py-4 space-y-3.5 max-h-[260px] min-h-[220px]">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}>
                    <div className={`p-3 rounded-xl max-w-[85%] text-xs ${
                      msg.sender === "user" 
                        ? "bg-blue-600 text-white rounded-br-none" 
                        : "bg-gray-100 dark:bg-slate-700/60 text-gray-800 dark:text-slate-200 rounded-bl-none"
                    }`}>
                      <p className="leading-relaxed">{msg.text}</p>
                    </div>
                    <span className="text-[9px] text-gray-400 mt-1 px-1">{msg.time}</span>
                  </div>
                ))}
                
                {botTyping && (
                  <div className="flex flex-col items-start animate-pulse">
                    <div className="p-3 rounded-xl bg-gray-100 dark:bg-slate-700/60 text-gray-800 dark:text-slate-200 rounded-bl-none">
                      <div className="flex gap-1.5 py-0.5 items-center">
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce animation-delay-200" />
                        <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce animation-delay-400" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input form */}
              <form onSubmit={handleSendMessage} className="pt-3 border-t border-gray-100 dark:border-slate-700/60 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a quick question..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 border border-gray-200 dark:border-slate-700 rounded-xl px-3 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                />
                <button
                  type="submit"
                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Support FAQs */}
            <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-5 h-5 text-indigo-500" />
                <h3 className="font-bold text-sm text-gray-950 dark:text-white">Support FAQs</h3>
              </div>

              <div className="space-y-2">
                {filteredFaqs.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-slate-500 py-4 text-center">No FAQ matches found for "{searchQuery}".</p>
                ) : (
                  filteredFaqs.map((faq, idx) => {
                    const isOpen = expandedFaq === idx;
                    return (
                      <div key={idx} className="border border-gray-100 dark:border-slate-700/60 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedFaq(isOpen ? null : idx)}
                          className="w-full flex items-center justify-between p-3 bg-gray-50/50 dark:bg-slate-700/10 hover:bg-gray-50 dark:hover:bg-slate-700/30 text-left transition duration-150"
                        >
                          <span className="font-semibold text-xs text-gray-900 dark:text-white">{faq.q}</span>
                          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 shrink-0 ml-1 ${isOpen ? "rotate-180" : ""}`} />
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

          </div>
        </div>
      </main>

      {/* Back to Home bottom bar */}
      <div className="bg-gray-100 dark:bg-slate-900 border-t border-gray-200/80 dark:border-slate-800/80 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400">Want to schedule a custom system integration tutorial?</p>
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
