import React from "react";
import {
  MessageSquare,
  User,
  Mail,
  Building,
  RefreshCw,
  Send,
  Ticket,
} from "lucide-react";

export default function ContactForm({
  formData,
  setFormData,
  submittedTicket,
  setSubmittedTicket,
  submitting,
  handleFormSubmit,
}) {
  if (submittedTicket) {
    return (
      <div className="p-4 sm:p-6 border-2 border-dashed border-blue-200 dark:border-blue-900/60 bg-blue-50/20 dark:bg-blue-950/10 rounded-2xl space-y-6 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
          <Ticket className="w-7 h-7" />
        </div>
        <div>
          <h3 className="font-bold text-xl text-gray-900 dark:text-white">
            Support Ticket Issued
          </h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Our support systems have registered your request. Write down your
            ticket tracking UUID.
          </p>
        </div>

        <div className="max-w-md mx-auto bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800/80 rounded-2xl p-4 text-left text-xs sm:text-sm space-y-3.5 shadow-xs">
          <div className="flex justify-between items-center pb-2 border-b border-gray-50 dark:border-slate-800">
            <span className="text-gray-400 font-medium">Ticket ID</span>
            <span className="font-extrabold text-blue-600 dark:text-blue-400 tracking-wider font-mono">
              {submittedTicket.id}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400 font-medium">Recipient</span>
              <p className="font-bold text-gray-800 dark:text-slate-300 mt-0.5 truncate">
                {submittedTicket.name}
              </p>
            </div>
            <div>
              <span className="text-gray-400 font-medium">Department</span>
              <p className="font-bold text-gray-800 dark:text-slate-300 mt-0.5 capitalize">
                {submittedTicket.department}
              </p>
            </div>
            <div>
              <span className="text-gray-400 font-medium">SLA Resolution</span>
              <p className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {submittedTicket.sla}
              </p>
            </div>
            <div>
              <span className="text-gray-400 font-medium">Ticket Status</span>
              <p className="font-bold text-gray-800 dark:text-slate-300 mt-0.5">
                {submittedTicket.status}
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-gray-50 dark:border-slate-800">
            <span className="text-gray-400 font-medium">Subject</span>
            <p className="font-semibold text-gray-700 dark:text-slate-300 mt-0.5 truncate">
              {submittedTicket.subject}
            </p>
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
            onClick={() =>
              document
                .querySelector(".live-chat-widget")
                ?.scrollIntoView({ behavior: "smooth" })
            }
            className="px-4 py-2 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 font-semibold text-xs rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
          >
            Ask Live Assistant
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Send Us a Message
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
            Submit your request below and we will route it to the correct desk.
          </p>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Your Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-gray-400" />
              </span>
              <input
                type="text"
                required
                placeholder="Jane Doe"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400" />
              </span>
              <input
                type="email"
                required
                placeholder="jane@company.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Organization
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Building className="h-4 w-4 text-gray-400" />
              </span>
              <input
                type="text"
                placeholder="e.g. Acme Corp (Optional)"
                value={formData.org}
                onChange={(e) =>
                  setFormData({ ...formData, org: e.target.value })
                }
                className="w-full border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              Department
            </label>
            <select
              value={formData.department}
              onChange={(e) =>
                setFormData({ ...formData, department: e.target.value })
              }
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
          <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Subject
          </label>
          <input
            type="text"
            required
            placeholder="Summarize the support request..."
            value={formData.subject}
            onChange={(e) =>
              setFormData({ ...formData, subject: e.target.value })
            }
            className="w-full border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            Message Details
          </label>
          <textarea
            required
            rows={4}
            placeholder="Provide details of your question or issue, including relevant meeting dates or transcription IDs..."
            value={formData.message}
            onChange={(e) =>
              setFormData({ ...formData, message: e.target.value })
            }
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
              <RefreshCw className="w-4 h-4 animate-spin" /> Submitting
              Request...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Submit Support Request
            </>
          )}
        </button>
      </form>
    </>
  );
}
