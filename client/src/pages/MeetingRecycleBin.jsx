import React, { useCallback, useContext, useEffect, useState } from "react";
import { ArrowLeft, RotateCcw, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent.js";
import { meetingApi } from "../services/meetingApi.js";

const MeetingRecycleBin = () => {
  const navigate = useNavigate();
  const { userData } = useContext(AppContent);
  const canPurge = userData?.role === "admin" || userData?.role === "owner";
  const [meetings, setMeetings] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadMeetings = useCallback(
    async (page = 1, query = search) => {
      setLoading(true);
      try {
        const { data } = await meetingApi.getDeletedMeetings({
          page,
          limit: 12,
          search: query || undefined,
        });
        setMeetings(data.meetings || []);
        setPagination(data.pagination || { page: 1, totalPages: 1 });
      } catch (error) {
        toast.error(
          error.response?.data?.message || "Failed to load recycle bin",
        );
      } finally {
        setLoading(false);
      }
    },
    [search],
  );

  useEffect(() => {
    loadMeetings(1);
  }, [loadMeetings]);

  const restore = async (meeting) => {
    if (!window.confirm(`Restore “${meeting.title}”?`)) return;
    try {
      await meetingApi.restoreDeletedMeeting(meeting._id);
      toast.success("Meeting restored");
      loadMeetings(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || "Restore failed");
    }
  };

  const purge = async (meeting) => {
    if (
      !window.confirm(
        `Permanently delete “${meeting.title}”? This cannot be undone.`,
      )
    )
      return;
    try {
      await meetingApi.permanentlyDeleteMeeting(meeting._id);
      toast.success("Meeting permanently deleted");
      loadMeetings(pagination.page);
    } catch (error) {
      toast.error(error.response?.data?.message || "Permanent deletion failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pt-8">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <button
              onClick={() => navigate("/meetings")}
              className="inline-flex items-center gap-2 text-blue-600 mb-3"
            >
              <ArrowLeft size={18} /> Back to meetings
            </button>
            <h1 className="text-3xl font-bold">Meeting recycle bin</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Deleted meetings can be restored before permanent removal.
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              loadMeetings(1, search);
            }}
            className="flex gap-2"
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search deleted meetings"
              className="rounded-lg border px-3 py-2 bg-white dark:bg-gray-900"
            />
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-white"
              aria-label="Search"
            >
              <Search size={18} />
            </button>
          </form>
        </div>

        {loading ? (
          <p className="py-16 text-center">Loading deleted meetings...</p>
        ) : meetings.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-gray-500">
            Recycle bin is empty.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {meetings.map((meeting) => (
              <article
                key={meeting._id}
                className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-5"
              >
                <h2 className="font-semibold text-lg">{meeting.title}</h2>
                <p className="text-sm text-gray-500 mt-2">
                  Deleted {new Date(meeting.deletedAt).toLocaleString()}
                </p>
                {meeting.deletedBy?.name && (
                  <p className="text-sm text-gray-500">
                    By {meeting.deletedBy.name}
                  </p>
                )}
                {meeting.deletionReason && (
                  <p className="text-sm mt-3">
                    Reason: {meeting.deletionReason}
                  </p>
                )}
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => restore(meeting)}
                    className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-white"
                  >
                    <RotateCcw size={16} /> Restore
                  </button>
                  {canPurge && (
                    <button
                      onClick={() => purge(meeting)}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-white"
                    >
                      <Trash2 size={16} /> Delete forever
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="flex justify-center gap-3 mt-8">
            <button
              disabled={pagination.page <= 1}
              onClick={() => loadMeetings(pagination.page - 1)}
              className="px-4 py-2 border rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="py-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadMeetings(pagination.page + 1)}
              className="px-4 py-2 border rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingRecycleBin;
