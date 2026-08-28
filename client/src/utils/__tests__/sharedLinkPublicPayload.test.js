import { describe, expect, it, vi } from "vitest";
import {
  normalizeShareSettings,
  shapeAttachmentMetadata,
  buildTranscriptExcerpt,
  buildPublicMeetingResource,
} from "../../../../server/utils/sharedLinkPublicPayload.js";

const mockScanAndRedact = vi.fn(async ({ text }) => ({
  redactedText: text?.replace(/test@example.com/g, "[REDACTED_EMAIL_1]"),
  findings: [],
}));

describe("sharedLinkPublicPayload (#2239)", () => {
  it("normalizes share settings defaults", () => {
    expect(normalizeShareSettings({})).toEqual({
      includeTranscript: false,
      includeAttachments: false,
      includeClips: false,
      redactPii: true,
      redactParticipantNames: false,
    });
  });

  it("strips attachment file paths from metadata", () => {
    const shaped = shapeAttachmentMetadata([
      {
        _id: "a1",
        fileName: "notes.pdf",
        fileType: "pdf",
        fileSize: 2048,
        mimeType: "application/pdf",
        filePath: "/secret/path/notes.pdf",
        createdAt: "2026-08-01T00:00:00.000Z",
      },
    ]);
    expect(shaped[0].fileName).toBe("notes.pdf");
    expect(shaped[0].filePath).toBeUndefined();
  });

  it("redacts speaker names when configured", () => {
    const excerpt = buildTranscriptExcerpt(
      [{ text: "Hello", speaker: "Alice", startTime: 0, endTime: 1 }],
      { redactParticipantNames: true },
    );
    expect(excerpt[0].speaker).toBe("Participant");
  });

  it("includes optional sections only when enabled", async () => {
    const payload = await buildPublicMeetingResource({
      meeting: {
        title: "Sync",
        description: "Weekly",
        date: "2026-08-01T00:00:00.000Z",
        summary: "Discussed roadmap",
        structuredMoM: null,
        participants: [{}, {}],
      },
      settings: normalizeShareSettings({
        includeTranscript: true,
        includeAttachments: true,
        includeClips: false,
        redactPii: false,
      }),
      organizationId: "org-1",
      meetingId: "meeting-1",
      transcriptDoc: {
        segments: [
          {
            text: "Email me at test@example.com",
            speaker: "Bob",
            startTime: 0,
            endTime: 2,
          },
        ],
      },
      attachments: [
        {
          _id: "att-1",
          fileName: "deck.pdf",
          fileType: "pdf",
          fileSize: 1000,
          mimeType: "application/pdf",
        },
      ],
      clips: [],
      scanAndRedact: mockScanAndRedact,
    });

    expect(payload.includedSections).toEqual({
      transcript: true,
      attachments: true,
      clips: false,
    });
    expect(payload.transcriptExcerpt).toHaveLength(1);
    expect(payload.attachments).toHaveLength(1);
    expect(payload.clips).toBeUndefined();
  });

  it("applies PII redaction to transcript text", async () => {
    const payload = await buildPublicMeetingResource({
      meeting: {
        title: "Sync",
        date: "2026-08-01T00:00:00.000Z",
        participants: [],
      },
      settings: normalizeShareSettings({
        includeTranscript: true,
        redactPii: true,
      }),
      organizationId: "org-1",
      meetingId: "meeting-1",
      transcriptDoc: {
        segments: [
          {
            text: "Contact test@example.com",
            speaker: "Bob",
            startTime: 0,
            endTime: 2,
          },
        ],
      },
      attachments: [],
      clips: [],
      scanAndRedact: mockScanAndRedact,
    });

    expect(payload.transcriptExcerpt[0].text).toContain("[REDACTED_EMAIL_1]");
    expect(mockScanAndRedact).toHaveBeenCalled();
  });
});
