// server/controllers/asyncMeetingController.js

// Mock persistent database tables
const asyncMeetings = {};
const reminderJobsLog = [];

// --- Submission Access Gatekeeper ---
export const submitAsyncResponse = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { userId, responses } = req.body;

    const meeting = asyncMeetings[meetingId];
    if (!meeting)
      return res.status(404).json({ error: "Async meeting not found" });

    // Late Submissions Blocked when Locked Constraint
    const now = new Date();
    if (now > new Date(meeting.deadline)) {
      return res.status(403).json({
        error:
          "SUBMISSION_LOCKED: The submission deadline has passed for this asynchronous meeting.",
      });
    }

    meeting.submissions[userId] = responses;
    return res
      .status(200)
      .json({ success: true, message: "Response submitted successfully" });
  } catch (_error) {
    return res.status(500).json({ error: "Internal submission failure" });
  }
};

// --- Conversion Eligibility Validation Engine ---
export const convertToAsync = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { deadline, attendees } = req.body;

    // Harden validation: ensure deadlines reside in the future and participants exist
    if (!deadline || new Date(deadline) <= new Date()) {
      return res.status(400).json({
        error: "INVALID_DEADLINE: Target deadline must be a future date.",
      });
    }
    if (!attendees || attendees.length === 0) {
      return res.status(400).json({
        error:
          "ELIGIBILITY_FAILED: Cannot convert an empty meeting without participants.",
      });
    }

    asyncMeetings[meetingId] = {
      meetingId,
      deadline: new Date(deadline).toISOString(),
      attendees,
      submissions: {},
      remindersSentCount: 0,
    };

    // Schedule automated notifications 24 hours prior to deadline target
    scheduleDeadlineReminderJob(meetingId, deadline);

    return res
      .status(201)
      .json({ success: true, data: asyncMeetings[meetingId] });
  } catch (_error) {
    return res
      .status(500)
      .json({ error: "Internal processing conversion fault" });
  }
};

// --- Reminder Scheduling Simulation Helper ---
const scheduleDeadlineReminderJob = (meetingId, deadlineIso) => {
  const reminderTime = new Date(
    new Date(deadlineIso).getTime() - 24 * 60 * 60 * 1000,
  );
  reminderJobsLog.push({
    meetingId,
    scheduledFor: reminderTime.toISOString(),
    fired: false,
  });
};

export const triggerScheduledReminders = () => {
  const now = new Date();
  reminderJobsLog.forEach((job) => {
    if (now >= new Date(job.scheduledFor) && !job.fired) {
      job.fired = true;
      const meeting = asyncMeetings[job.meetingId];
      if (meeting) meeting.remindersSentCount += 1;
    }
  });
};

export { asyncMeetings, reminderJobsLog };
