import MeetingAttendance from "../models/meetingAttendanceModel.js";
import Meeting from "../models/meetingModel.js";

/**
 * Initialize attendance records for all participants of a meeting
 * @param {string} meetingId
 * @param {Array} participants
 */
export const initializeAttendance = async (meetingId, participants) => {
  if (!participants || participants.length === 0) return;

  const attendanceRecords = participants.map((p) => ({
    meetingId,
    user: p.user || null,
    email: p.email,
    name: p.name,
    status: "invited",
  }));

  try {
    // Upsert to handle updates gracefully (e.g. adding new participants later)
    const ops = attendanceRecords.map((record) => ({
      updateOne: {
        filter: { meetingId: record.meetingId, email: record.email },
        update: { $setOnInsert: record },
        upsert: true,
      },
    }));
    await MeetingAttendance.bulkWrite(ops);
  } catch (error) {
    console.error("Error initializing attendance:", error);
    throw error;
  }
};

/**
 * Check in a participant
 * @param {string} meetingId
 * @param {string} email
 * @param {Date} joinTime
 */
export const checkIn = async (meetingId, email, joinTime = new Date()) => {
  try {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) throw new Error("Meeting not found");

    let lateMinutes = 0;
    if (meeting.date) {
      // Calculate lateness based on scheduled start time
      // Assuming meeting.date has the date and time, or we can use time field
      const scheduledStart = new Date(meeting.date);
      if (meeting.time) {
        const [hours, minutes] = meeting.time.split(":");
        scheduledStart.setHours(
          parseInt(hours, 10),
          parseInt(minutes, 10),
          0,
          0,
        );
      }
      const diffMs = joinTime - scheduledStart;
      if (diffMs > 0) {
        lateMinutes = Math.floor(diffMs / 60000);
      }
    }

    const attendance = await MeetingAttendance.findOneAndUpdate(
      { meetingId, email },
      {
        $set: {
          status: "checked_in",
          joinTime,
          lateMinutes,
        },
      },
      { new: true, upsert: true }, // Upsert in case of an uninvited guest
    );

    return attendance;
  } catch (error) {
    console.error("Error during check-in:", error);
    throw error;
  }
};

/**
 * Check out a participant
 * @param {string} meetingId
 * @param {string} email
 * @param {Date} leaveTime
 */
export const checkOut = async (meetingId, email, leaveTime = new Date()) => {
  try {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) throw new Error("Meeting not found");

    let earlyLeaveMinutes = 0;
    if (meeting.date && meeting.duration) {
      const scheduledStart = new Date(meeting.date);
      if (meeting.time) {
        const [hours, minutes] = meeting.time.split(":");
        scheduledStart.setHours(
          parseInt(hours, 10),
          parseInt(minutes, 10),
          0,
          0,
        );
      }
      const scheduledEnd = new Date(
        scheduledStart.getTime() + meeting.duration * 60000,
      );
      const diffMs = scheduledEnd - leaveTime;
      if (diffMs > 0) {
        earlyLeaveMinutes = Math.floor(diffMs / 60000);
      }
    }

    const attendance = await MeetingAttendance.findOneAndUpdate(
      { meetingId, email },
      {
        $set: { leaveTime, earlyLeaveMinutes },
      },
      { new: true },
    );

    return attendance;
  } catch (error) {
    console.error("Error during check-out:", error);
    throw error;
  }
};

/**
 * Mark a participant as excused
 * @param {string} meetingId
 * @param {string} email
 */
export const markExcused = async (meetingId, email) => {
  try {
    const attendance = await MeetingAttendance.findOneAndUpdate(
      { meetingId, email },
      { $set: { status: "excused" } },
      { new: true },
    );
    return attendance;
  } catch (error) {
    console.error("Error marking excused:", error);
    throw error;
  }
};

/**
 * Finalize attendance for a meeting, marking remaining invited users as no_show
 * @param {string} meetingId
 */
export const finalizeAttendance = async (meetingId) => {
  try {
    await MeetingAttendance.updateMany(
      { meetingId, status: "invited" },
      { $set: { status: "no_show" } },
    );
  } catch (error) {
    console.error("Error finalizing attendance:", error);
    throw error;
  }
};
