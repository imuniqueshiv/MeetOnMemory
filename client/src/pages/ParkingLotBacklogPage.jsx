import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { Calendar, Filter, Lightbulb, RefreshCw, Search } from "lucide-react";
import AppContent from "../context/AppContent";
import Navbar from "../components/Navbar.jsx";
import OrganizationEmptyState from "../components/organization/OrganizationEmptyState";
import { meetingApi, parkingLotApi } from "../services";
import { hasPermission } from "../utils/rbacPermissions";

const STATUSES = ["pending", "scheduled", "discarded"];

const getId = (value) => {
  if (!value) return "";
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

const getMeetingTitle = (meeting) => meeting?.title || "Untitled meeting";

const ParkingLotBacklogPage = () => {
  const { userData, loading: authLoading } = useContext(AppContent) || {};
  const organizationId =
    userData?.organization?._id || userData?.organization || null;
  const canEdit = hasPermission(userData?.role, "meetings", "edit");
  const requestIdRef = useRef(0);

  const [items, setItems] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [meetingFilter, setMeetingFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  const fetchItems = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    if (!organizationId) {
      setItems([]);
      setMeetings([]);
      setError("");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const [parkingLotRes, meetingsRes] = await Promise.all([
        parkingLotApi.getOrganizationParkingLot(organizationId, { limit: 200 }),
        meetingApi.getAllMeetings().catch(() => null),
      ]);
      if (requestId !== requestIdRef.current) return;

      const payload = parkingLotRes?.data;
      if (payload?.success) {
        setItems(payload.data?.items || []);
      } else {
        setItems([]);
        setError(payload?.message || "Failed to load parking lot items");
      }

      const meetingPayload = meetingsRes?.data;
      setMeetings(meetingPayload?.success ? meetingPayload.meetings || [] : []);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error("Failed to fetch parking lot items", err);
      setItems([]);
      setMeetings([]);
      setError(
        err.response?.data?.message || "Failed to load parking lot items",
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [organizationId]);

  useEffect(() => {
    if (authLoading) return;
    fetchItems();
  }, [authLoading, fetchItems]);

  const assignableMeetings = useMemo(() => {
    const seen = new Map();
    meetings.forEach((meeting) => {
      const id = getId(meeting);
      if (id) seen.set(id, getMeetingTitle(meeting));
    });
    items.forEach((item) => {
      [item.sourceMeetingId, item.scheduledForMeetingId].forEach((meeting) => {
        const id = getId(meeting);
        if (id && !seen.has(id)) {
          seen.set(id, getMeetingTitle(meeting));
        }
      });
    });
    return Array.from(seen, ([id, title]) => ({ id, title }));
  }, [items, meetings]);

  const assignees = useMemo(() => {
    const seen = new Map();
    items.forEach((item) => {
      const id = getId(item.submittedBy);
      if (!id || seen.has(id)) return;
      seen.set(id, item.submittedBy?.name || "Unknown");
    });
    return Array.from(seen, ([id, name]) => ({ id, name }));
  }, [items]);

  const sourceMeetings = useMemo(() => {
    const seen = new Map();
    items.forEach((item) => {
      const id = getId(item.sourceMeetingId);
      if (!id || seen.has(id)) return;
      seen.set(id, getMeetingTitle(item.sourceMeetingId));
    });
    return Array.from(seen, ([id, title]) => ({ id, title }));
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      if (
        assigneeFilter !== "all" &&
        getId(item.submittedBy) !== assigneeFilter
      ) {
        return false;
      }
      if (
        meetingFilter !== "all" &&
        getId(item.sourceMeetingId) !== meetingFilter
      ) {
        return false;
      }
      if (!query) return true;
      const haystack = [
        item.topic,
        item.submittedBy?.name,
        item.sourceMeetingId?.title,
        item.scheduledForMeetingId?.title,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [items, statusFilter, assigneeFilter, meetingFilter, search]);

  const handleStatusChange = async (id, status) => {
    if (!canEdit || updatingId) return;
    try {
      setUpdatingId(id);
      const { data } = await parkingLotApi.updateTopicStatus(id, { status });
      if (data.success) {
        toast.success("Item status updated.");
        setItems((prev) =>
          prev.map((item) =>
            item._id === id ? { ...item, ...(data.item || { status }) } : item,
          ),
        );
      } else {
        toast.error(data.message || "Failed to update status.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update status.");
    } finally {
      setUpdatingId("");
    }
  };

  const handleAssigneeChange = async (id, meetingId) => {
    if (!canEdit || updatingId || !meetingId) return;
    try {
      setUpdatingId(id);
      const { data } = await parkingLotApi.assignTopics({
        topicIds: [id],
        meetingId,
      });
      if (data.success) {
        toast.success("Item assigned to meeting.");
        const assigned = data.items?.find((item) => item._id === id);
        const selectedMeeting = assignableMeetings.find(
          (meeting) => meeting.id === meetingId,
        );
        setItems((prev) =>
          prev.map((item) =>
            item._id === id
              ? assigned || {
                  ...item,
                  status: "scheduled",
                  scheduledForMeetingId: {
                    _id: meetingId,
                    title: selectedMeeting?.title || "Meeting",
                  },
                }
              : item,
          ),
        );
      } else {
        toast.error(data.message || "Failed to update assignee.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update assignee.");
    } finally {
      setUpdatingId("");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex-grow container mx-auto px-4 pt-24 pb-12 sm:pt-28">
          <div
            data-testid="parking-lot-loading"
            role="status"
            aria-label="Loading parking lot backlog"
            aria-busy="true"
            className="animate-pulse h-32 rounded-xl bg-gray-200 dark:bg-gray-700"
          />
        </div>
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div
          data-testid="parking-lot-no-org"
          className="flex-grow container mx-auto px-4 pt-24 pb-12 sm:pt-28"
        >
          <OrganizationEmptyState />
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="parking-lot-backlog-page"
      data-organization-id={String(organizationId)}
      className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900"
    >
      <Navbar />
      <div className="flex-grow container mx-auto px-4 pt-24 pb-12 sm:pt-28 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Lightbulb className="h-7 w-7 text-yellow-500" aria-hidden="true" />
            Parking Lot Backlog
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Review parked ideas for the selected organization, update their
            status, assign them to a meeting, and jump back to the source
            meeting.
          </p>
        </div>

        {error ? (
          <div
            data-testid="parking-lot-error"
            role="alert"
            className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700"
          >
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              {error}
            </p>
            <button
              type="button"
              onClick={fetchItems}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Search
                <span className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search topics, people, or meetings"
                    aria-label="Search parking lot items"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Status
                <span className="relative">
                  <Filter
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                    aria-hidden="true"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter by status"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">All statuses</option>
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Assignee
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  aria-label="Filter by assignee"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All assignees</option>
                  {assignees.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                Source meeting
                <select
                  value={meetingFilter}
                  onChange={(e) => setMeetingFilter(e.target.value)}
                  aria-label="Filter by source meeting"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="all">All meetings</option>
                  {sourceMeetings.map((meeting) => (
                    <option key={meeting.id} value={meeting.id}>
                      {meeting.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {filteredItems.length === 0 ? (
              <div
                data-testid="parking-lot-empty"
                className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700"
              >
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  No parking lot items found
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Parked ideas from meetings will appear here for the selected
                  organization.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {filteredItems.map((item) => {
                  const sourceId = getId(item.sourceMeetingId);
                  const assignedMeetingId = getId(item.scheduledForMeetingId);
                  return (
                    <li
                      key={item._id}
                      data-testid={`parking-lot-item-${item._id}`}
                      className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {item.topic}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Added by {item.submittedBy?.name || "Unknown"}
                          </p>
                          {sourceId ? (
                            <Link
                              to={`/meeting/${sourceId}`}
                              className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              <Calendar
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              {item.sourceMeetingId?.title || "Source meeting"}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1 mt-2 text-sm text-gray-500 dark:text-gray-400">
                              Unknown meeting
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                            Status
                            <select
                              value={item.status || "pending"}
                              disabled={!canEdit || updatingId === item._id}
                              aria-label={`Update status for ${item.topic}`}
                              onChange={(e) =>
                                handleStatusChange(item._id, e.target.value)
                              }
                              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                            >
                              {STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                            Assignee
                            <select
                              value={assignedMeetingId}
                              disabled={
                                !canEdit ||
                                updatingId === item._id ||
                                assignableMeetings.length === 0
                              }
                              aria-label={`Update assignee for ${item.topic}`}
                              onChange={(e) =>
                                handleAssigneeChange(item._id, e.target.value)
                              }
                              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
                            >
                              <option value="">
                                {assignedMeetingId
                                  ? "Select meeting"
                                  : "Unassigned"}
                              </option>
                              {assignableMeetings.map((meeting) => (
                                <option key={meeting.id} value={meeting.id}>
                                  {meeting.title}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ParkingLotBacklogPage;
