import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { io } from "socket.io-client";
import { getActivities, exportActivities } from "../api/activityApi";
import AppContent from "../context/AppContent.js";
import {
  Calendar,
  FileText,
  User,
  Activity as ActivityIcon,
  Download,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getBackendUrl } from "../config/backendConfig.js";
import { createClerkSocketOptions } from "../services/apiClient.js";

const backendUrl = getBackendUrl();

const EMPTY_FILTERS = {
  action: "",
  targetType: "",
  actor: "",
  from: "",
  to: "",
};

export default function ActivityFeed() {
  const { userData } = useContext(AppContent);
  const organization = userData?.organization;
  const organizationId = organization?._id || organization || null;

  const [activities, setActivities] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [socketState, setSocketState] = useState("disconnected");
  const [exporting, setExporting] = useState(false);
  const observer = useRef();
  const socketRef = useRef(null);

  const loadActivities = useCallback(
    async (pageNum, append = false, nextFilters = appliedFilters) => {
      if (!organizationId) return;
      try {
        setLoading(true);
        setError("");
        const data = await getActivities({
          page: pageNum,
          limit: 20,
          ...Object.fromEntries(
            Object.entries(nextFilters).filter(([, value]) => value),
          ),
        });
        const incoming = data.activities || [];

        if (append) {
          setActivities((prev) => {
            const ids = new Set(prev.map((item) => item._id));
            return [...prev, ...incoming.filter((item) => !ids.has(item._id))];
          });
        } else {
          setActivities(incoming);
        }
        setPage(pageNum);
        setHasMore(data.currentPage < data.totalPages);
      } catch (err) {
        console.error("Failed to load activities", err);
        setError("Unable to load activity right now. Please retry.");
      } finally {
        setLoading(false);
      }
    },
    [organizationId, appliedFilters],
  );

  useEffect(() => {
    if (organizationId) {
      setPage(1);
      loadActivities(1, false, appliedFilters);
    } else {
      setActivities([]);
    }
  }, [organizationId, loadActivities, appliedFilters]);

  // Explicit organization-room membership plus reconnect handling.
  useEffect(() => {
    if (!organizationId) return;

    let cancelled = false;

    (async () => {
      const opts = await createClerkSocketOptions({
        transports: ["websocket", "polling"],
      });
      if (cancelled) return;

      const socket = io(backendUrl, opts);
      socketRef.current = socket;

      const joinActivityRoom = () => {
        setSocketState("connected");
        socket.emit("activity:join", {
          organizationId: organizationId.toString(),
        });
      };

      socket.on("connect", joinActivityRoom);
      socket.on("reconnect", joinActivityRoom);
      socket.on("disconnect", () => setSocketState("disconnected"));
      socket.on("connect_error", () => setSocketState("error"));
      socket.on("activity:error", () => setSocketState("error"));

      socket.on("activity:new", (newActivity) => {
        if (
          newActivity?.organization &&
          newActivity.organization.toString() !== organizationId.toString()
        ) {
          return;
        }

        setActivities((prev) => {
          if (
            !newActivity?._id ||
            prev.some((item) => item._id === newActivity._id)
          ) {
            return prev;
          }
          return [newActivity, ...prev];
        });
      });
    })();

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      if (socket) {
        socket.emit("activity:leave", {
          organizationId: organizationId.toString(),
        });
        socket.disconnect();
      }
      socketRef.current = null;
      setSocketState("disconnected");
    };
  }, [organizationId]);

  const lastActivityElementRef = useCallback(
    (node) => {
      if (loading || !hasMore) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          const nextPage = page + 1;
          loadActivities(nextPage, true);
        }
      });

      if (node) observer.current.observe(node);
    },
    [loading, hasMore, page, loadActivities],
  );

  const actorOptions = useMemo(() => {
    const map = new Map();
    activities.forEach((activity) => {
      if (activity.actor?._id) {
        map.set(
          activity.actor._id,
          activity.actor.name || activity.actor.email || "Unknown actor",
        );
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [activities]);

  const actionOptions = useMemo(
    () =>
      Array.from(
        new Set(activities.map((item) => item.action).filter(Boolean)),
      ).sort(),
    [activities],
  );

  const typeOptions = useMemo(
    () =>
      Array.from(
        new Set(activities.map((item) => item.targetType).filter(Boolean)),
      ).sort(),
    [activities],
  );

  const applyFilters = (event) => {
    event.preventDefault();
    setAppliedFilters({ ...filters });
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await exportActivities(
        Object.fromEntries(
          Object.entries(appliedFilters).filter(([, value]) => value),
        ),
      );
      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `activity-feed-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export activities", err);
      setError("Unable to export the current activity filter.");
    } finally {
      setExporting(false);
    }
  };

  const getIconForAction = (action = "") => {
    if (action.startsWith("meeting"))
      return <Calendar className="w-5 h-5 text-blue-500" />;
    if (action.startsWith("policy"))
      return <FileText className="w-5 h-5 text-green-500" />;
    if (action.startsWith("membership"))
      return <User className="w-5 h-5 text-purple-500" />;
    return <ActivityIcon className="w-5 h-5 text-gray-500" />;
  };

  const getActionText = (activity) => {
    const actorName = activity.actor?.name || "Someone";
    switch (activity.action) {
      case "meeting.created":
        return `${actorName} scheduled a meeting: ${activity.targetTitle}`;
      case "meeting.uploaded":
        return `${actorName} uploaded a meeting: ${activity.targetTitle}`;
      case "meeting.updated":
        return `${actorName} updated meeting: ${activity.targetTitle}`;
      case "meeting.deleted":
        return `${actorName} deleted meeting: ${activity.targetTitle}`;
      case "policy.created":
        return `${actorName} uploaded a policy: ${activity.targetTitle}`;
      case "policy.updated":
        return `${actorName} updated policy: ${activity.targetTitle}`;
      case "policy.deleted":
        return `${actorName} deleted policy: ${activity.targetTitle}`;
      case "membership.role_updated":
        return `${actorName} updated role for ${activity.targetTitle}`;
      case "membership.removed":
        return `${actorName} removed member ${activity.targetTitle}`;
      case "membership.left":
        return `${actorName} left the organization`;
      default:
        return `${actorName} performed ${activity.action} on ${activity.targetTitle}`;
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Organization Activity
          </h1>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            {socketState === "connected" ? (
              <>
                <Wifi className="w-3.5 h-3.5 text-green-500" /> Live updates
                connected
              </>
            ) : socketState === "error" ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-500" /> Reconnecting…
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" /> Connecting…
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !organizationId}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </div>

      <form
        onSubmit={applyFilters}
        className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 bg-white dark:bg-gray-800 rounded-lg shadow p-4"
        aria-label="Activity filters"
      >
        <select
          value={filters.action}
          onChange={(e) =>
            setFilters((f) => ({ ...f, action: e.target.value }))
          }
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm"
          aria-label="Filter by activity"
        >
          <option value="">All activities</option>
          {actionOptions.map((action) => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
        <select
          value={filters.targetType}
          onChange={(e) =>
            setFilters((f) => ({ ...f, targetType: e.target.value }))
          }
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm"
          aria-label="Filter by type"
        >
          <option value="">All target types</option>
          {typeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select
          value={filters.actor}
          onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value }))}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm"
          aria-label="Filter by actor"
        >
          <option value="">All actors</option>
          {actorOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm"
          aria-label="Activity start date"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2 text-sm"
          aria-label="Activity end date"
        />
        <div className="md:col-span-2 lg:col-span-5 flex gap-2">
          <button
            type="submit"
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 dark:text-gray-900 text-white rounded-md text-sm font-semibold"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => loadActivities(1, false)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm inline-flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </form>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {!organizationId && !loading ? (
          <p className="text-gray-500 text-center py-8">
            Join or select an organization to view activity.
          </p>
        ) : activities.length === 0 && !loading ? (
          <p className="text-gray-500 text-center py-8">
            No activity matches the current filters.
          </p>
        ) : (
          <div className="relative border-l border-gray-200 dark:border-gray-700 ml-3">
            {activities.map((activity, index) => {
              const isLast = activities.length === index + 1;
              return (
                <div
                  key={activity._id}
                  ref={isLast ? lastActivityElementRef : null}
                  className="mb-8 ml-6"
                >
                  <span className="absolute flex items-center justify-center w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full -left-4 ring-4 ring-white dark:ring-gray-900">
                    {getIconForAction(activity.action)}
                  </span>
                  <div className="flex items-center space-x-3 mb-1">
                    {activity.actor?.avatarUrl ? (
                      <img
                        src={activity.actor.avatarUrl}
                        alt="avatar"
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                        {activity.actor?.name?.charAt(0)}
                      </div>
                    )}
                    <h3 className="flex items-center mb-1 text-base font-semibold text-gray-900 dark:text-white">
                      {getActionText(activity)}
                    </h3>
                  </div>
                  <time className="block mb-2 text-sm font-normal leading-none text-gray-400 dark:text-gray-500">
                    {formatDistanceToNow(new Date(activity.createdAt), {
                      addSuffix: true,
                    })}
                  </time>
                  {activity.metadata?.commitMsg && (
                    <p className="text-sm font-normal text-gray-500 dark:text-gray-400 mt-2 italic border-l-2 border-gray-300 pl-3">
                      "{activity.metadata.commitMsg}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        )}
      </div>
    </div>
  );
}
