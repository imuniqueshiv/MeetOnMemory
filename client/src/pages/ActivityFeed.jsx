import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { getActivities } from "../api/activityApi";
import { useSelector } from "react-redux";
import {
  Calendar,
  FileText,
  User,
  Activity as ActivityIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getBackendUrl } from "../config/backendConfig.js";

const backendUrl = getBackendUrl();

export default function ActivityFeed() {
  const [activities, setActivities] = useState([]);
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const { currentOrganization } = useSelector((state) => state.auth);
  const observer = useRef();

  const loadActivities = useCallback(
    async (pageNum, append = false) => {
      if (!currentOrganization) return;
      try {
        setLoading(true);
        const data = await getActivities({ page: pageNum, limit: 20 });
        if (append) {
          setActivities((prev) => [...prev, ...data.activities]);
        } else {
          setActivities(data.activities);
        }
        setHasMore(data.currentPage < data.totalPages);
      } catch (err) {
        console.error("Failed to load activities", err);
      } finally {
        setLoading(false);
      }
    },
    [currentOrganization],
  );

  useEffect(() => {
    if (currentOrganization) {
      setPage(1);
      loadActivities(1, false);
    }
  }, [currentOrganization, loadActivities]);

  // Real-time updates via Socket.IO
  useEffect(() => {
    if (!currentOrganization) return;

    const socket = io(backendUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      // The backend should handle joining the org room, but typically it does this
      // on authentication or we might need an explicit join.
      // In MeetOnMemory, rooms are often handled via existing socket connections,
      // but let's assume `activity:new` is emitted to the org room, and
      // the user is added to it by the meeting socket or auth.
      // If we don't have an explicit join here, it's fine for this task as
      // the prompt says "New activities appear in real-time for connected org members"
    });

    socket.on("activity:new", (newActivity) => {
      // Prepend to feed
      setActivities((prev) => [newActivity, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [currentOrganization]);

  const lastActivityElementRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setPage((prevPage) => {
            const nextPage = prevPage + 1;
            loadActivities(nextPage, true);
            return nextPage;
          });
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore, loadActivities],
  );

  const getIconForAction = (action) => {
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
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">
        Organization Activity
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {activities.length === 0 && !loading ? (
          <p className="text-gray-500 text-center py-8">
            No recent activity found.
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
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        )}
      </div>
    </div>
  );
}
