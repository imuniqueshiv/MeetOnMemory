import React, { useState } from "react";
import { toast } from "react-toastify";
import { ClipboardCopy, RefreshCw } from "lucide-react";
import standupApi from "../../services/standupApi";

const RANGES = [
  { value: "yesterday", label: "Yesterday" },
  { value: "today", label: "Today" },
  { value: "7day", label: "Past 7 days" },
];

const SECTIONS = [
  { key: "done", title: "Yesterday", tone: "text-emerald-600" },
  { key: "inProgress", title: "Today", tone: "text-blue-600" },
  { key: "blockers", title: "Blockers", tone: "text-red-600" },
];

/**
 * Issue #2426 — Automated Standup Report Generator.
 * Compiles a user's / team's action items into a Yesterday / Today / Blockers
 * standup over a chosen window.
 */
const StandupReportGenerator = () => {
  const [range, setRange] = useState("yesterday");
  const [scope, setScope] = useState("personal");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await standupApi.getReport({ range, scope });
      setData(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate standup report");
    } finally {
      setLoading(false);
    }
  };

  const copyMarkdown = async () => {
    if (!data?.markdown) return;
    try {
      await navigator.clipboard.writeText(data.markdown);
      toast.success("Standup copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const standup = data?.standup;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Standup Generator
      </h3>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Range
          <select
            className="mt-1 block rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
            value={range}
            onChange={(e) => setRange(e.target.value)}
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Scope
          <select
            className="mt-1 block rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="personal">Personal</option>
            <option value="team">Team</option>
          </select>
        </label>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          <RefreshCw size={14} /> {loading ? "Generating…" : "Generate"}
        </button>
        {data?.markdown && (
          <button
            type="button"
            onClick={copyMarkdown}
            className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <ClipboardCopy size={14} /> Copy
          </button>
        )}
      </div>

      {standup && (
        <div className="grid gap-4 md:grid-cols-3">
          {SECTIONS.map((section) => {
            const items = standup[section.key] || [];
            return (
              <div
                key={section.key}
                className="rounded-md border border-gray-100 p-3 dark:border-gray-700"
              >
                <h4 className={`mb-2 text-sm font-semibold ${section.tone}`}>
                  {section.title}{" "}
                  <span className="text-gray-400">({items.length})</span>
                </h4>
                {items.length === 0 ? (
                  <p className="text-xs text-gray-400">Nothing here.</p>
                ) : (
                  <ul className="space-y-1">
                    {items.map((item, i) => (
                      <li
                        key={i}
                        className="text-xs text-gray-700 dark:text-gray-200"
                      >
                        • {item.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StandupReportGenerator;
