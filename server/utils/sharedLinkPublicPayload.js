/**
 * Default share-link content settings for meeting public views (#2239).
 */
export const DEFAULT_SHARE_SETTINGS = Object.freeze({
  includeTranscript: false,
  includeAttachments: false,
  includeClips: false,
  redactPii: true,
  redactParticipantNames: false,
});

export const normalizeShareSettings = (raw = {}) => ({
  includeTranscript: Boolean(raw.includeTranscript),
  includeAttachments: Boolean(raw.includeAttachments),
  includeClips: Boolean(raw.includeClips),
  redactPii: raw.redactPii !== false,
  redactParticipantNames: Boolean(raw.redactParticipantNames),
});

const redactSpeaker = (speaker, redactParticipantNames) => {
  if (!redactParticipantNames || !speaker) return speaker;
  return "Participant";
};

export const shapeAttachmentMetadata = (attachments = []) =>
  attachments.map(
    ({ _id, fileName, fileType, fileSize, mimeType, createdAt }) => ({
      _id,
      fileName,
      fileType,
      fileSize,
      mimeType,
      createdAt,
    }),
  );

export const buildTranscriptExcerpt = (segments = [], settings) => {
  const excerpt = segments.map((segment) => ({
    text: segment.text,
    speaker: redactSpeaker(segment.speaker, settings.redactParticipantNames),
    startTime: segment.startTime,
    endTime: segment.endTime,
  }));
  return excerpt;
};

export const buildClipPayload = (clips = [], settings) =>
  clips.map(
    ({
      _id,
      title,
      description,
      startTime,
      endTime,
      labels,
      transcriptSegments,
    }) => ({
      _id,
      title,
      description,
      startTime,
      endTime,
      labels,
      transcriptSegments: (transcriptSegments || []).map((segment) => ({
        text: segment.text,
        speaker: redactSpeaker(
          segment.speaker,
          settings.redactParticipantNames,
        ),
        startTime: segment.startTime,
        endTime: segment.endTime,
      })),
    }),
  );

export const applyTextRedaction = async (
  text,
  { redactPii, organizationId, meetingId },
  scanAndRedact,
) => {
  if (!text || !redactPii) return text;
  const { redactedText } = await scanAndRedact({
    organizationId,
    meetingId,
    text,
    persistAudit: false,
  });
  return redactedText;
};

export const applyStructuredMoMRedaction = async (
  structuredMoM,
  context,
  scanAndRedact,
) => {
  if (!structuredMoM) return structuredMoM;
  const next = { ...structuredMoM };

  if (Array.isArray(next.decisions)) {
    next.decisions = await Promise.all(
      next.decisions.map((item) =>
        applyTextRedaction(item, context, scanAndRedact),
      ),
    );
  }

  if (Array.isArray(next.action_items)) {
    next.action_items = await Promise.all(
      next.action_items.map(async (item) => ({
        ...item,
        task: await applyTextRedaction(item.task, context, scanAndRedact),
        assignee: context.redactParticipantNames ? undefined : item.assignee,
      })),
    );
  }

  return next;
};

export const buildMeetingBasePayload = (meeting) => ({
  title: meeting.title,
  description: meeting.description,
  date: meeting.date,
  time: meeting.time,
  location: meeting.location,
  venue: meeting.venue || "",
  venueCoordinates: meeting.venueCoordinates || null,
  participants: meeting.participants
    ? Array(meeting.participants.length).fill({})
    : [],
});

export const buildPublicMeetingResource = async ({
  meeting,
  settings,
  organizationId,
  meetingId,
  transcriptDoc,
  attachments,
  clips,
  scanAndRedact,
}) => {
  const context = {
    redactPii: settings.redactPii,
    redactParticipantNames: settings.redactParticipantNames,
    organizationId,
    meetingId,
  };

  const payload = buildMeetingBasePayload(meeting);

  payload.description = await applyTextRedaction(
    meeting.description,
    context,
    scanAndRedact,
  );
  payload.summary = await applyTextRedaction(
    meeting.summary,
    context,
    scanAndRedact,
  );
  payload.structuredMoM = await applyStructuredMoMRedaction(
    meeting.structuredMoM,
    context,
    scanAndRedact,
  );

  payload.includedSections = {
    transcript: settings.includeTranscript,
    attachments: settings.includeAttachments,
    clips: settings.includeClips,
  };

  if (settings.includeTranscript) {
    const segments = transcriptDoc?.segments?.length
      ? transcriptDoc.segments
      : meeting.transcript
        ? [
            {
              text: meeting.transcript,
              speaker: "Speaker",
              startTime: 0,
              endTime: 0,
            },
          ]
        : [];

    let excerpt = buildTranscriptExcerpt(segments, settings);
    if (settings.redactPii) {
      excerpt = await Promise.all(
        excerpt.map(async (segment) => ({
          ...segment,
          text: await applyTextRedaction(segment.text, context, scanAndRedact),
        })),
      );
    }
    payload.transcriptExcerpt = excerpt;
  }

  if (settings.includeAttachments) {
    payload.attachments = shapeAttachmentMetadata(attachments);
  }

  if (settings.includeClips) {
    let clipPayload = buildClipPayload(clips, settings);
    if (settings.redactPii) {
      clipPayload = await Promise.all(
        clipPayload.map(async (clip) => ({
          ...clip,
          description: await applyTextRedaction(
            clip.description,
            context,
            scanAndRedact,
          ),
          transcriptSegments: await Promise.all(
            clip.transcriptSegments.map(async (segment) => ({
              ...segment,
              text: await applyTextRedaction(
                segment.text,
                context,
                scanAndRedact,
              ),
            })),
          ),
        })),
      );
    }
    payload.clips = clipPayload;
  }

  return payload;
};
