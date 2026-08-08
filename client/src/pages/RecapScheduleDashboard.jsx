import React, { useState, useEffect, useContext } from "react";
import { format } from "date-fns";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import { recapScheduleApi } from "../services/recapScheduleApi";
import {
  Clock,
  Mail,
  CheckCircle2,
  RefreshCw,
  Save,
  AlertCircle,
  Calendar,
} from "lucide-react";

const RecapScheduleDashboard = () => {
  const { userData } = useContext(AppContent);
  const organizationId = userData?.organization?._id || userData?.organization;

  const [schedule, setSchedule] = useState({
    scheduleType: "immediate",
    deliveryChannel: "email",
    preferredTime: "09:00",
    timezone: "UTC",
    startDate: "",
    endDate: "",
  });
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [scheduleRes, historyRes] = await Promise.allSettled([
          recapScheduleApi.getSchedule(organizationId),
          recapScheduleApi.getDeliveryHistory(),
        ]);

        if (scheduleRes.status === "fulfilled" && scheduleRes.value.data) {
          const data = scheduleRes.value.data;
          setSchedule({
            scheduleType: data.scheduleType || "immediate",
            deliveryChannel: data.deliveryChannel || "email",
            preferredTime: data.preferredTime || "09:00",
            timezone: data.timezone || "UTC",
            startDate: data.startDate
              ? new Date(data.startDate).toISOString().slice(0, 10)
              : "",
            endDate: data.endDate
              ? new Date(data.endDate).toISOString().slice(0, 10)
              : "",
          });
        }

        if (historyRes.status === "fulfilled" && historyRes.value.data) {
          setHistory(historyRes.value.data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (organizationId) {
      fetchData();
    }
  }, [organizationId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSchedule((prev) => ({ ...prev, [name]: value }));
    if (saveMessage.type === "error") {
      setSaveMessage({ type: "", text: "" });
    }
  };

  const validateSchedule = () => {
    if (!schedule.timezone || !schedule.timezone.trim()) {
      return "Timezone cannot be empty.";
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    if (schedule.startDate && schedule.startDate < todayStr) {
      return "Start date cannot be in the past.";
    }

    if (
      schedule.startDate &&
      schedule.endDate &&
      schedule.endDate < schedule.startDate
    ) {
      return "End date must be on or after start date.";
    }

    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();

    const validationError = validateSchedule();
    if (validationError) {
      setSaveMessage({ type: "error", text: validationError });
      return;
    }

    setIsSaving(true);
    setSaveMessage({ type: "", text: "" });

    try {
      await recapScheduleApi.upsertSchedule(organizationId, schedule);
      setSaveMessage({
        type: "success",
        text: "Schedule updated successfully!",
      });
      setTimeout(() => setSaveMessage({ type: "", text: "" }), 3000);
    } catch (error) {
      console.error("Save error:", error);
      setSaveMessage({ type: "error", text: "Failed to update schedule." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetry = async (deliveryId) => {
    try {
      await recapScheduleApi.retryDelivery(deliveryId);
      alert("Retry enqueued successfully!");
    } catch (error) {
      console.error("Retry failed:", error);
      alert("Failed to enqueue retry.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-28 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Recap Scheduling & Delivery
          </h1>
          <p className="mt-2 text-slate-600 dark:text-gray-400">
            Configure how and when you receive meeting recaps and view delivery
            history.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Configuration Form */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-6 border border-slate-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-blue-600" />
                  Schedule Settings
                </h2>

                <form noValidate onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                      Delivery Frequency
                    </label>
                    <select
                      name="scheduleType"
                      value={schedule.scheduleType}
                      onChange={handleChange}
                      className="w-full rounded-lg border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="immediate">Immediate</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                      Delivery Channel
                    </label>
                    <select
                      name="deliveryChannel"
                      value={schedule.deliveryChannel}
                      onChange={handleChange}
                      className="w-full rounded-lg border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="email">Email</option>
                      <option value="in_app">In-App Only</option>
                      <option value="webhook">Webhook</option>
                    </select>
                  </div>

                  {schedule.scheduleType !== "immediate" && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                        Preferred Time
                      </label>
                      <input
                        type="time"
                        name="preferredTime"
                        value={schedule.preferredTime}
                        onChange={handleChange}
                        className="w-full rounded-lg border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                      Timezone
                    </label>
                    <input
                      type="text"
                      name="timezone"
                      value={schedule.timezone}
                      onChange={handleChange}
                      placeholder="e.g., UTC, America/New_York"
                      className="w-full rounded-lg border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>

                  {/* Date Range Validation Fields (#1308) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="schedule-start-date"
                        className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1 flex items-center gap-1"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Start Date
                      </label>
                      <input
                        id="schedule-start-date"
                        type="date"
                        name="startDate"
                        value={schedule.startDate}
                        onChange={handleChange}
                        className="w-full rounded-lg border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="schedule-end-date"
                        className="block text-xs font-medium text-slate-700 dark:text-gray-300 mb-1 flex items-center gap-1"
                      >
                        <Calendar className="w-3.5 h-3.5" /> End Date
                      </label>
                      <input
                        id="schedule-end-date"
                        type="date"
                        name="endDate"
                        value={schedule.endDate}
                        onChange={handleChange}
                        className="w-full rounded-lg border-slate-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white text-xs shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 cursor-pointer"
                  >
                    {isSaving ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSaving ? "Saving..." : "Save Preferences"}
                  </button>

                  {saveMessage.text && (
                    <div
                      role="alert"
                      className={`p-3 rounded-md flex items-center gap-2 text-sm ${
                        saveMessage.type === "success"
                          ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {saveMessage.type === "success" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4" />
                      )}
                      {saveMessage.text}
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Delivery History */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-gray-800 shadow rounded-xl border border-slate-200 dark:border-gray-700 flex flex-col h-full">
                <div className="p-6 border-b border-slate-200 dark:border-gray-700">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Mail className="w-5 h-5 text-indigo-600" />
                    Delivery History
                  </h2>
                </div>

                <div className="p-0 overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-gray-900/50 text-slate-500 dark:text-gray-400 text-sm">
                        <th className="px-6 py-3 font-medium">Meeting</th>
                        <th className="px-6 py-3 font-medium">Date</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium text-right">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-gray-700 text-sm">
                      {history.length > 0 ? (
                        history.map((delivery) => (
                          <tr
                            key={delivery._id}
                            className="hover:bg-slate-50 dark:hover:bg-gray-750"
                          >
                            <td className="px-6 py-4 text-slate-900 dark:text-white font-medium">
                              {delivery.meetingId?.title || "Unknown Meeting"}
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-gray-400">
                              {format(
                                new Date(delivery.deliveredAt),
                                "MMM d, yyyy h:mm a",
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-500/20">
                                <CheckCircle2 className="w-3 h-3" /> Delivered
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleRetry(delivery._id)}
                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium cursor-pointer"
                              >
                                Retry
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan="4"
                            className="px-6 py-8 text-center text-slate-500 dark:text-gray-400"
                          >
                            No delivery history found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecapScheduleDashboard;
