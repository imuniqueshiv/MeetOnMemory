import React from "react";
import { format } from "date-fns";
import CustomFieldsEditor from "../meetings/CustomFieldsEditor";
import { customFieldApi } from "../../api/customFieldApi";
import { meetingApi } from "../../services";
import { toast } from "react-toastify";
import TagInput from "./TagInput";

const MeetingMetadata = ({ meeting, onUpdate, isReadOnly = false }) => {
  if (!meeting) return null;

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      return format(new Date(dateString), "MMM dd, yyyy 'at' h:mm a");
    } catch {
      return "N/A";
    }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "N/A";
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const metadataItems = [
    {
      label: "Organization",
      value: meeting.organization || "Not specified",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
    },
    {
      label: "Created By",
      value: meeting.uploadedBy || "Unknown",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    {
      label: "Upload Date",
      value: formatDate(meeting.createdAt),
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      label: "Meeting Date",
      value: formatDate(meeting.date),
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      label: "Duration",
      value: formatDuration(meeting.duration),
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      label: "Meeting Type",
      value: meeting.meetingType || "conference",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      ),
    },
    {
      label: "Location",
      value: meeting.location || "Not specified",
      icon: (
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
  ];

  const tags = meeting.tags || [];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Meeting Metadata
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metadataItems.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <div className="text-gray-400 mt-0.5">{item.icon}</div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {item.label}
              </p>
              <p className="text-sm text-gray-900 font-medium">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      <TagInput
        tags={tags}
        readOnly={isReadOnly}
        onTagsChange={async (newTags) => {
          try {
            await meetingApi.updateMeeting(meeting._id, { tags: newTags });
            if (onUpdate) onUpdate({ ...meeting, tags: newTags });
            toast.success("Tags updated successfully");
          } catch (err) {
            console.error("Error updating tags:", err);
            toast.error("Failed to update tags");
          }
        }}
      />

      {meeting.organization && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <CustomFieldsEditor
            orgId={meeting.organization}
            meetingId={meeting._id}
            onChange={async (fields, isValid) => {
              if (isValid && fields.length > 0) {
                try {
                  await customFieldApi.setMeetingFields(
                    meeting._id,
                    meeting.organization,
                    fields,
                  );
                } catch (err) {
                  console.error(err);
                  toast.error("Failed to update custom fields");
                }
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default MeetingMetadata;
