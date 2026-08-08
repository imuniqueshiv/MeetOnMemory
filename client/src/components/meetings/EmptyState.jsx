import React from "react";
import { Calendar, Search, FileText } from "lucide-react";
import RoleGate from "../RoleGate.jsx";
import { useRBAC } from "../../hooks/useRBAC.js";

const EmptyState = ({ type }) => {
  const { hasPermission } = useRBAC();
  const canCreateMeeting = hasPermission("meetings", "create");

  const states = {
    noMeetings: {
      icon: <Calendar size={64} className="text-gray-300 dark:text-gray-600" />,
      title: "No Meetings Yet",
      description: canCreateMeeting
        ? "You haven't uploaded any meetings yet. Start by uploading your first meeting to see it here."
        : "You haven't uploaded any meetings yet. Meetings shared with you will appear here.",
      actionText: "Upload Your First Meeting",
      actionLink: "/upload-meeting",
      requiresCreate: true,
    },
    noResults: {
      icon: <Search size={64} className="text-gray-300 dark:text-gray-600" />,
      title: "No Meetings Found",
      description:
        "We couldn't find any meetings matching your search or filters. Try adjusting your criteria.",
      actionText: "Clear Filters",
      actionLink: null,
      requiresCreate: false,
    },
    noScheduled: {
      icon: <FileText size={64} className="text-gray-300 dark:text-gray-600" />,
      title: "No Scheduled Meetings",
      description: canCreateMeeting
        ? "You don't have any scheduled meetings. Schedule a new meeting to get started."
        : "You don't have any scheduled meetings right now.",
      actionText: "Schedule a Meeting",
      actionLink: "/create-meeting",
      requiresCreate: true,
    },
  };

  const state = states[type] || states.noMeetings;

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="mb-6">{state.icon}</div>
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
        {state.title}
      </h3>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-8">
        {state.description}
      </p>
      {state.actionLink &&
        (state.requiresCreate ? (
          <RoleGate resource="meetings" action="create">
            <a
              href={state.actionLink}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              {state.actionText}
            </a>
          </RoleGate>
        ) : (
          <a
            href={state.actionLink}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            {state.actionText}
          </a>
        ))}
    </div>
  );
};

export default EmptyState;
