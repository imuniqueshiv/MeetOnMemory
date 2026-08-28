import AsyncMeeting from "../models/asyncMeetingModel.js";
import { generateText } from "./GenerativeAIService.js";
import { createNotification } from "./notificationService.js";

export const createAsyncMeeting = async (data) => {
  const meeting = new AsyncMeeting({
    originalMeetingId: data.originalMeetingId,
    creator: data.creator,
    title: data.title,
    participants: data.participants,
    template: data.template,
    deadline: data.deadline,
  });

  await meeting.save();

  // Notify participants
  for (const participantId of meeting.participants) {
    if (participantId.toString() !== meeting.creator.toString()) {
      await createNotification(
        participantId,
        "New Async Meeting Request",
        `You have been requested to provide an update for "${meeting.title}" before ${new Date(meeting.deadline).toLocaleString()}`,
        "system",
        "",
        "",
        { type: "ASYNC_MEETING_CREATED", referenceId: meeting._id },
      );
    }
  }

  return meeting;
};

export const submitUpdate = async (meetingId, userId, answers) => {
  const meeting = await AsyncMeeting.findById(meetingId);
  if (!meeting) {
    throw new Error("Async meeting not found");
  }

  if (meeting.status !== "pending") {
    throw new Error("Async meeting is no longer accepting submissions");
  }

  const existingSubmission = meeting.submissions.find(
    (sub) => sub.user.toString() === userId.toString(),
  );

  if (existingSubmission) {
    existingSubmission.answers = answers;
    existingSubmission.submittedAt = new Date();
  } else {
    meeting.submissions.push({
      user: userId,
      answers,
      submittedAt: new Date(),
    });
  }

  await meeting.save();
  return meeting;
};

export const lockAndSummarize = async (meetingId) => {
  const meeting = await AsyncMeeting.findById(meetingId).populate(
    "submissions.user",
    "name email",
  );
  if (!meeting) {
    throw new Error("Async meeting not found");
  }

  meeting.status = "locked";
  await meeting.save();

  try {
    let summaryInput = `Async Meeting: ${meeting.title}\n\n`;
    summaryInput += `Template Questions:\n${meeting.template.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\n`;
    summaryInput += `Submissions:\n`;

    meeting.submissions.forEach((sub) => {
      summaryInput += `--- User: ${sub.user.name} ---\n`;
      sub.answers.forEach((ans) => {
        summaryInput += `Q: ${ans.question}\nA: ${ans.answer}\n\n`;
      });
    });

    const prompt = `You are an AI assistant tasked with creating a consolidated "Virtual Meeting Summary" from asynchronous status updates.
Below are the template questions and the submissions from various participants.
Synthesize the updates into a cohesive summary. Highlight key accomplishments, blockers, and next steps across the team.

${summaryInput}
`;

    const aiSummary = await generateText(prompt);

    meeting.aiSummary = aiSummary;
    meeting.status = "completed";
    await meeting.save();

    // Notify all participants that summary is ready
    const allUsers = new Set([
      meeting.creator.toString(),
      ...meeting.participants.map((p) => p.toString()),
    ]);

    for (const participantId of allUsers) {
      await createNotification(
        participantId,
        "Async Meeting Summary Ready",
        `The summary for "${meeting.title}" is now available.`,
        "system",
        "",
        "",
        { type: "ASYNC_MEETING_COMPLETED", referenceId: meeting._id },
      );
    }

    return meeting;
  } catch (error) {
    console.error("Error generating AI summary for async meeting", error);
    // Keep it locked if AI fails, can retry manually or fix
    throw error;
  }
};
