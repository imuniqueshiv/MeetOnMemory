import React from "react";
import useMeetingAttendance from "../../hooks/useMeetingAttendance";

const AttendanceTracker = ({ meetingId, isHost }) => {
  const {
    attendance,
    loading,
    error,
    checkIn,
    checkOut,
    markExcused,
    finalizeAttendance,
    stats,
  } = useMeetingAttendance(meetingId);

  if (loading)
    return <div className="p-4 text-gray-500">Loading attendance...</div>;
  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;

  const getStatusColor = (status) => {
    switch (status) {
      case "checked_in":
        return "bg-green-100 text-green-800";
      case "no_show":
        return "bg-red-100 text-red-800";
      case "excused":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case "checked_in":
        return "Checked In";
      case "no_show":
        return "No Show";
      case "excused":
        return "Excused";
      default:
        return "Invited";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Attendance Tracker
      </h3>

      {/* Stats Summary Bar */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="bg-blue-50 text-blue-700 px-3 py-2 rounded">
          <span className="font-bold">{stats.total}</span> Total
        </div>
        <div className="bg-green-50 text-green-700 px-3 py-2 rounded">
          <span className="font-bold">{stats.checkedIn}</span> Present
        </div>
        <div className="bg-red-50 text-red-700 px-3 py-2 rounded">
          <span className="font-bold">{stats.noShow}</span> No Show
        </div>
        <div className="bg-yellow-50 text-yellow-700 px-3 py-2 rounded">
          <span className="font-bold">{stats.excused}</span> Excused
        </div>
        <div className="bg-gray-50 text-gray-700 px-3 py-2 rounded">
          <span className="font-bold">{stats.invited}</span> Pending
        </div>
      </div>

      {/* Actions */}
      {isHost && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={finalizeAttendance}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            Finalize (Mark No-Shows)
          </button>
        </div>
      )}

      {/* Participant List */}
      <div className="space-y-3">
        {attendance.length === 0 ? (
          <p className="text-gray-500 text-sm">No attendance records found.</p>
        ) : (
          attendance.map((record) => (
            <div
              key={record._id || record.email}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-100"
            >
              <div className="flex flex-col">
                <span className="font-medium text-gray-800">
                  {record.name || record.email}
                </span>
                <span className="text-xs text-gray-500">{record.email}</span>
                {record.lateMinutes > 0 && (
                  <span className="text-xs text-orange-500 font-medium mt-1">
                    {record.lateMinutes} mins late
                  </span>
                )}
                {record.earlyLeaveMinutes > 0 && (
                  <span className="text-xs text-purple-500 font-medium mt-1">
                    Left {record.earlyLeaveMinutes} mins early
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(record.status)}`}
                >
                  {getStatusLabel(record.status)}
                </span>

                {isHost && record.status === "invited" && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => checkIn(record.email)}
                      className="px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded text-xs transition-colors"
                    >
                      Check In
                    </button>
                    <button
                      onClick={() => markExcused(record.email)}
                      className="px-2 py-1 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded text-xs transition-colors"
                    >
                      Excuse
                    </button>
                  </div>
                )}
                {isHost && record.status === "checked_in" && (
                  <button
                    onClick={() => checkOut(record.email)}
                    className="px-2 py-1 bg-gray-200 text-gray-700 hover:bg-gray-300 rounded text-xs transition-colors"
                  >
                    Check Out
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AttendanceTracker;
