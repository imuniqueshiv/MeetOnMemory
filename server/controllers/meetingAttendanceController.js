import * as attendanceService from "../services/meetingAttendanceService.js";
import MeetingAttendance from "../models/meetingAttendanceModel.js";

/**
 * @desc    Get attendance records for a meeting
 * @route   GET /api/meetings/:meetingId/attendance
 * @access  Private
 */
export const getMeetingAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const records = await MeetingAttendance.find({ meetingId }).populate(
      "user",
      "firstName lastName avatar",
    );
    res.status(200).json(records);
  } catch (error) {
    console.error("Error fetching attendance:", error);
    res.status(500).json({ message: "Server error fetching attendance" });
  }
};

/**
 * @desc    Check in a participant
 * @route   POST /api/meetings/:meetingId/attendance/checkin
 * @access  Private
 */
export const checkIn = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { email, joinTime } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email is required for check-in" });
    }

    const attendance = await attendanceService.checkIn(
      meetingId,
      email,
      joinTime ? new Date(joinTime) : new Date(),
    );
    res.status(200).json(attendance);
  } catch (error) {
    console.error("Error during check-in:", error);
    res.status(500).json({ message: "Server error during check-in" });
  }
};

/**
 * @desc    Check out a participant
 * @route   POST /api/meetings/:meetingId/attendance/checkout
 * @access  Private
 */
export const checkOut = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { email, leaveTime } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email is required for check-out" });
    }

    const attendance = await attendanceService.checkOut(
      meetingId,
      email,
      leaveTime ? new Date(leaveTime) : new Date(),
    );
    res.status(200).json(attendance);
  } catch (error) {
    console.error("Error during check-out:", error);
    res.status(500).json({ message: "Server error during check-out" });
  }
};

/**
 * @desc    Mark a participant as excused
 * @route   PUT /api/meetings/:meetingId/attendance/excuse
 * @access  Private
 */
export const markExcused = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email is required to mark excused" });
    }

    const attendance = await attendanceService.markExcused(meetingId, email);
    res.status(200).json(attendance);
  } catch (error) {
    console.error("Error marking excused:", error);
    res.status(500).json({ message: "Server error marking excused" });
  }
};

/**
 * @desc    Finalize attendance (mark no-shows)
 * @route   POST /api/meetings/:meetingId/attendance/finalize
 * @access  Private
 */
export const finalizeAttendance = async (req, res) => {
  try {
    const { meetingId } = req.params;
    await attendanceService.finalizeAttendance(meetingId);
    res.status(200).json({ message: "Attendance finalized successfully" });
  } catch (error) {
    console.error("Error finalizing attendance:", error);
    res.status(500).json({ message: "Server error finalizing attendance" });
  }
};
