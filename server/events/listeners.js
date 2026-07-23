import eventBus from "../services/eventBus.js";
import { createNotification } from "../services/notificationService.js";
import { incrementEngagementScore } from "../services/engagementScoringService.js";

export const initListeners = (io) => {
  if (!io) {
    console.warn("⚠️ initListeners: Socket.IO instance is not provided.");
    return;
  }

  // ─────────────────────────────────────────────────────────────
  // MEETINGS
  // ─────────────────────────────────────────────────────────────

  eventBus.on("meeting.created", async ({ meeting, membersToNotify = [] }) => {
    for (const membership of membersToNotify) {
      const formattedNotification = await createNotification(
        membership.user._id,
        "New Meeting Scheduled",
        `A new meeting "${meeting.title}" has been scheduled.`,
        "meetings",
        `/meeting/${meeting._id}`,
        "View Details",
      );
      if (formattedNotification) {
        io.to(membership.user._id.toString()).emit(
          "notification:new",
          formattedNotification,
        );
      }
    }

    if (meeting.uploadedBy && meeting.organization) {
      await incrementEngagementScore(
        meeting.uploadedBy,
        meeting.organization,
        "meetingsCreated",
      );
    }
  });

  // ─────────────────────────────────────────────────────────────
  // MoM / AI PROCESSING
  // ─────────────────────────────────────────────────────────────

  eventBus.on("mom.generated", async (meeting) => {
    const userId = meeting.uploadedBy || meeting.owner;
    if (userId) {
      const formattedNotification = await createNotification(
        userId,
        "Minutes of Meeting Generated",
        `MoM for "${meeting.title}" is ready.`,
        "ai_processing",
        `/meeting/${meeting._id}`,
        "View MoM",
      );
      if (formattedNotification) {
        io.to(userId.toString()).emit(
          "notification:new",
          formattedNotification,
        );
      }

      io.to(userId.toString()).emit("mom-generation-complete", {
        meetingId: meeting._id,
        title: meeting.title,
        summary: meeting.summary,
        mom: meeting.structuredMoM,
      });
    }

    if (meeting.organization) {
      const participants = meeting.participants || [];
      for (const participant of participants) {
        const participantId =
          participant.user || participant._id || participant;
        if (participantId && participantId.toString() !== userId?.toString()) {
          await incrementEngagementScore(
            participantId,
            meeting.organization,
            "meetingsAttended",
          );
        }
      }
    }
  });

  // ─────────────────────────────────────────────────────────────
  // DATA EXPORT
  // ─────────────────────────────────────────────────────────────

  eventBus.on("export.ready", async ({ userId, downloadUrl }) => {
    const formattedNotification = await createNotification(
      userId,
      "Data Export Ready",
      "Your data export has been completed and emailed to you.",
      "system",
      downloadUrl,
      "Download",
    );
    if (formattedNotification) {
      io.to(userId.toString()).emit("notification:new", formattedNotification);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // ORGANIZATIONS
  // ─────────────────────────────────────────────────────────────

  eventBus.on(
    "organization.joined",
    async ({ userId, _organizationId, organizationName, adminId }) => {
      if (adminId && adminId.toString() !== userId.toString()) {
        const formattedNotification = await createNotification(
          adminId,
          "New Member Joined",
          `A new user has joined your organization: ${organizationName}.`,
          "organizations",
          "/team-members",
          "View Team",
        );
        if (formattedNotification) {
          io.to(adminId.toString()).emit(
            "notification:new",
            formattedNotification,
          );
        }
      }
    },
  );

  eventBus.on(
    "live_meeting.notified",
    async ({ _uploaderId, roomId, participants, _orgId }) => {
      for (const user of participants) {
        const formattedNotification = await createNotification(
          user._id,
          "Live Meeting Started",
          "You have been invited to join a live meeting.",
          "meetings",
          `/meeting-room/${roomId}`,
          "Join Now",
        );
        if (formattedNotification) {
          io.to(user._id.toString()).emit(
            "notification:new",
            formattedNotification,
          );
        }
      }

      if (_orgId) {
        for (const user of participants) {
          await incrementEngagementScore(
            user._id,
            _orgId,
            "liveMeetingParticipation",
          );
        }
      }
    },
  );

  eventBus.on("actionItem.resolved", async ({ userId, organization }) => {
    if (userId && organization) {
      await incrementEngagementScore(
        userId,
        organization,
        "actionItemsResolved",
      );
    }
  });

  // ─────────────────────────────────────────────────────────────
  // POLICIES
  // ─────────────────────────────────────────────────────────────

  eventBus.on("policy.created", async (policy) => {
    const uploaderId = policy.uploadedBy?._id || policy.uploadedBy;
    if (uploaderId && policy.organization) {
      await incrementEngagementScore(
        uploaderId,
        policy.organization,
        "policiesUploaded",
      );
    }
  });

  eventBus.on("policy.updated", async (policy) => {
    const editorId = policy.lastEditedBy?._id || policy.lastEditedBy;
    if (editorId && policy.organization) {
      await incrementEngagementScore(
        editorId,
        policy.organization,
        "policiesUploaded",
      );
    }
  });

  console.log("✅ Event listeners initialized");
};
