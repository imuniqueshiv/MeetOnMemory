import { useState, useEffect, useCallback } from "react";
import api from "../services/apiClient";

const useMeetingAttendance = (meetingId) => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAttendance = useCallback(async () => {
    if (!meetingId) return;
    try {
      setLoading(true);
      const res = await api.get(`/meetings/${meetingId}/attendance`);
      setAttendance(res.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching meeting attendance:", err);
      setError(err.response?.data?.message || "Failed to fetch attendance");
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const checkIn = async (email, joinTime = new Date()) => {
    try {
      await api.post(`/meetings/${meetingId}/attendance/checkin`, {
        email,
        joinTime,
      });
      await fetchAttendance();
    } catch (err) {
      console.error("Error during manual check-in:", err);
      throw err;
    }
  };

  const checkOut = async (email, leaveTime = new Date()) => {
    try {
      await api.post(`/meetings/${meetingId}/attendance/checkout`, {
        email,
        leaveTime,
      });
      await fetchAttendance();
    } catch (err) {
      console.error("Error during manual check-out:", err);
      throw err;
    }
  };

  const markExcused = async (email) => {
    try {
      await api.put(`/meetings/${meetingId}/attendance/excuse`, { email });
      await fetchAttendance();
    } catch (err) {
      console.error("Error marking excused:", err);
      throw err;
    }
  };

  const finalizeAttendance = async () => {
    try {
      await api.post(`/meetings/${meetingId}/attendance/finalize`);
      await fetchAttendance();
    } catch (err) {
      console.error("Error finalizing attendance:", err);
      throw err;
    }
  };

  const getStats = () => {
    const stats = {
      total: attendance.length,
      checkedIn: 0,
      noShow: 0,
      excused: 0,
      invited: 0,
    };
    attendance.forEach((a) => {
      if (a.status === "checked_in") stats.checkedIn++;
      else if (a.status === "no_show") stats.noShow++;
      else if (a.status === "excused") stats.excused++;
      else if (a.status === "invited") stats.invited++;
    });
    return stats;
  };

  return {
    attendance,
    loading,
    error,
    fetchAttendance,
    checkIn,
    checkOut,
    markExcused,
    finalizeAttendance,
    stats: getStats(),
  };
};

export default useMeetingAttendance;
