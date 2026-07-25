import { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";
import { meetingApi } from "../services";
import axios from "axios";
import AppContent from "../context/AppContent";

export const useCalendarEvents = () => {
  const { backendUrl } = useContext(AppContent);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month"); // 'month' | 'week' | 'day'
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // Filter States
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [orgFilter, setOrgFilter] = useState("all");
  const [showExternalEvents, setShowExternalEvents] = useState(true);

  // Fetch Meetings
  useEffect(() => {
    const fetchMeetings = async () => {
      setLoading(true);
      try {
        const { data } = await meetingApi.getAllMeetings();
        let allMeetings = [];
        if (data.success) {
          allMeetings = data.meetings || [];
        } else {
          toast.error(data.message || "Failed to fetch meetings.");
        }

        // Fetch external events
        try {
          const { data: extData } = await axios.get(
            `${backendUrl || "http://localhost:4000"}/api/calendar/events`,
            { withCredentials: true },
          );
          if (extData.success && extData.events) {
            const externalEvents = extData.events.map((e) => ({
              _id: e.id,
              title: e.title,
              date: new Date(e.start),
              time: new Date(e.start).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              duration: (new Date(e.end) - new Date(e.start)) / 60000,
              venue: e.location,
              meetingType: "external",
              status: "upcoming",
              provider: e.provider,
              isExternal: true,
            }));
            allMeetings = [...allMeetings, ...externalEvents];
          }
        } catch (extErr) {
          console.error("External events fetch err:", extErr);
        }

        setMeetings(allMeetings);
      } catch (err) {
        console.error("Fetch meetings error:", err);
        toast.error("Error loading calendar data.");
      } finally {
        setLoading(false);
      }
    };

    fetchMeetings();
  }, [backendUrl]);

  // Filter Logic
  const filteredMeetings = meetings.filter((meeting) => {
    // Filter external events
    if (meeting.isExternal && !showExternalEvents) {
      return false;
    }

    const matchesStatus =
      statusFilter === "all" || meeting.status === statusFilter;
    const matchesType =
      typeFilter === "all" || meeting.meetingType === typeFilter;

    // Filter by organization
    let matchesOrg = true;
    if (orgFilter !== "all" && !meeting.isExternal) {
      if (orgFilter === "personal") {
        matchesOrg = !meeting.organization;
      } else {
        matchesOrg =
          meeting.organization === orgFilter ||
          (meeting.organization?._id &&
            meeting.organization._id === orgFilter) ||
          (meeting.organization?.name &&
            meeting.organization.name === orgFilter);
      }
    }

    return matchesStatus && matchesType && matchesOrg;
  });

  // Extract unique organizations for filters (exclude external events)
  const uniqueOrgs = Array.from(
    new Set(
      meetings
        .filter((m) => !m.isExternal)
        .map((m) => m.organization?.name || m.organization)
        .filter(Boolean),
    ),
  );

  return {
    meetings,
    loading,
    currentDate,
    setCurrentDate,
    view,
    setView,
    selectedMeeting,
    setSelectedMeeting,
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    orgFilter,
    setOrgFilter,
    showExternalEvents,
    setShowExternalEvents,
    filteredMeetings,
    uniqueOrgs,
  };
};
