import React, { useState, useEffect, useCallback, useContext } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Calendar, Loader2 } from "lucide-react";
import AppContent from "../context/AppContent";

const CalendarIntegrations = () => {
  const { backendUrl } = useContext(AppContent);
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await axios.get(`${backendUrl}/api/calendar/status`, {
        withCredentials: true,
      });
      if (res.data.success) {
        setIntegrations(res.data.integrations);
      }
    } catch (fetchErr) {
      console.error("Failed to fetch calendar integrations", fetchErr);
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  useEffect(() => {
    fetchIntegrations();

    // Check for callback errors in URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");
    if (error === "google_sync_failed") {
      toast.error("Failed to connect Google Calendar");
    } else if (error === "outlook_sync_failed") {
      toast.error("Failed to connect Outlook Calendar");
    }
  }, [fetchIntegrations]);

  const connectProvider = async (provider) => {
    try {
      const res = await axios.get(
        `${backendUrl}/api/calendar/${provider}/connect`,
        { withCredentials: true },
      );
      if (res.data.success && res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (connectErr) {
      console.error(`Failed to connect to ${provider}`, connectErr);
      toast.error(`Failed to connect to ${provider}`);
    }
  };

  const disconnectProvider = async (provider) => {
    try {
      const res = await axios.post(
        `${backendUrl}/api/calendar/disconnect/${provider}`,
        {},
        { withCredentials: true },
      );
      if (res.data.success) {
        toast.success(`Disconnected ${provider} calendar`);
        setIntegrations(integrations.filter((i) => i.provider !== provider));
      }
    } catch (disconnectErr) {
      console.error(`Failed to disconnect ${provider}`, disconnectErr);
      toast.error(`Failed to disconnect ${provider}`);
    }
  };

  const isConnected = (provider) =>
    integrations.some((i) => i.provider === provider);
  const getIntegration = (provider) =>
    integrations.find((i) => i.provider === provider);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm fade-in-up stagger-4 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-50 rounded-xl">
          <Calendar className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Calendar Integrations
          </h2>
          <p className="text-xs text-slate-500">
            Sync meetings with your external calendars
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Google Calendar */}
        <div className="flex items-center justify-between py-3 border-b border-slate-100">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Google Calendar
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isConnected("google")
                ? `Last synced: ${getIntegration("google").lastSyncedAt ? new Date(getIntegration("google").lastSyncedAt).toLocaleString() : "Never"}`
                : "Connect your Google account to sync meetings"}
            </p>
          </div>
          {isConnected("google") ? (
            <button
              onClick={() => disconnectProvider("google")}
              className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => connectProvider("google")}
              className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              Connect
            </button>
          )}
        </div>

        {/* Outlook Calendar */}
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Microsoft Outlook
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isConnected("outlook")
                ? `Last synced: ${getIntegration("outlook").lastSyncedAt ? new Date(getIntegration("outlook").lastSyncedAt).toLocaleString() : "Never"}`
                : "Connect your Microsoft account to sync meetings"}
            </p>
          </div>
          {isConnected("outlook") ? (
            <button
              onClick={() => disconnectProvider("outlook")}
              className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              Disconnect
            </button>
          ) : (
            <button
              onClick={() => connectProvider("outlook")}
              className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarIntegrations;
