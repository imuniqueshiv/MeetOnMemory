import mongoose from "mongoose";
import { normalizeAgendaItems } from "../utils/agendaOrdering.js";

const meetingSchema = new mongoose.Schema(
  {
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // user must be logged in
    },
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String, // Meeting description/objective
      default: "",
    },
    meetingType: {
      type: String, // conference, policy, event, internal
      enum: ["conference", "policy", "event", "internal"],
      default: "conference",
    },
    date: {
      type: Date,
      required: true,
    },
    time: {
      type: String, // Meeting time (e.g., "14:30")
      default: "",
    },

    // Meeting reminder notification settings (Issue #1766)
    reminderEnabled: {
      type: Boolean,
      default: false,
    },
    reminderMinutesBefore: {
      type: Number,
      enum: [10, 30, 60],
      default: 30,
    },
    reminderSentAt: {
      type: Date,
      default: null,
    },
    // Meeting nudge automation setting (Issue #2062)
    nudgesEnabled: {
      type: Boolean,
      default: true,
    },
    duration: {
      type: Number, // Duration in minutes
      default: null,
    },
    location: {
      type: String, // Location/platform (e.g., "Zoom", "Conference Room A")
      default: "",
    },
    allowObservers: {
      type: Boolean,
      default: false,
    },
    requireQuiz: {
      type: Boolean,
      default: false,
    },
    venue: {
      type: String, // Venue details (physical address or meeting link)
      default: "",
    },
    venueCoordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        name: { type: String, required: true },
        email: { type: String, default: "" },
        role: { type: String, default: "" },
      },
    ],
    agendaItems: [
      {
        text: { type: String, required: true },
        description: { type: String, default: "" },
        // Planned length, in MINUTES. Named `duration` for backwards
        // compatibility; see `actualDuration` below for the unit mismatch this
        // creates and why it is deliberate.
        duration: { type: Number, default: null },
        position: { type: Number, min: 0, default: 0 },

        // ── Live agenda timer (Issue #1159) ────────────────────────────────
        // `agendaTimerController` has always written these four fields. None
        // of them existed on the schema, and Mongoose is strict by default, so
        // every assignment was discarded before the document was saved — the
        // start/stop/skip endpoints returned 200 and persisted nothing, `stop`
        // returned 400 unconditionally because `status` was always `undefined`
        // on reload, and the pacing report was structurally all zeros.
        status: {
          type: String,
          enum: ["pending", "active", "completed", "skipped"],
          default: "pending",
        },
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        // Accumulated elapsed time, in MILLISECONDS.
        //
        // The unit differs from `duration` above, which is minutes. That is not
        // an oversight: `getAgendaPacingReport` already divides this by 60000
        // to report minutes, and `client/src/utils/agendaTiming.js` already
        // multiplies `duration` by 60 * 1000 to compare them. Both sides were
        // written against milliseconds; storing minutes here would silently
        // break both. It accumulates across start/stop cycles, so an item that
        // is paused and resumed reports its total.
        actualDuration: { type: Number, default: 0, min: 0 },
      },
    ],
    policyDetails: {
      // For policy-type meetings
      policyName: { type: String, default: "" },
      policyVersion: { type: String, default: "" },
      effectiveDate: { type: Date, default: null },
      approvalRequired: { type: Boolean, default: false },
    },
    recordingType: {
      type: String, // "upload" or "live"
      enum: ["upload", "live"],
      default: "upload",
    },
    fileUrl: {
      type: String, // Path or cloud link to uploaded audio/video file
      default: "",
    },
    transcript: {
      type: String, // Raw transcript text from AssemblyAI (legacy plaintext)
      default: "",
    },
    /**
     * Issue #1335 — Client-side E2EE ciphertext envelope.
     * When set, `transcript` is cleared and the server never holds plaintext.
     */
    encryptedTranscript: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    isTranscriptEncrypted: {
      type: Boolean,
      default: false,
    },
    transcriptEncryptionVersion: {
      type: Number,
      default: null,
    },
    summary: {
      type: String, // Human-readable MoM text
      default: "",
    },
    recapStory: {
      type: mongoose.Schema.Types.Mixed, // Cached JSON for the recap story slides
      default: null,
    },
    structuredMoM: {
      type: mongoose.Schema.Types.Mixed, // Structured JSON (title, decisions[], action_items[], attendees[])
      default: null,
    },
    aiNotes: {
      type: String, // Optional - additional AI notes
      default: "",
    },
    aiSummaryTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AiSummaryTemplate",
      default: null,
    },
    status: {
      type: String,
      enum: ["uploaded", "processing", "completed", "failed"],
      default: "uploaded",
    },
    tags: [String], // e.g., ["policy", "finance", "staff"]

    // ── Meeting series membership (Issue #1160) ──────────────────────────────
    // `createSeries` has always built its occurrences with `series` and
    // `seriesOccurrence` set and handed them to `Meeting.insertMany`. Neither
    // was a schema path, so Mongoose stripped both — the meetings were created
    // and then orphaned.
    //
    // Everything downstream reads the link: `getSeriesMeetings` queries
    // `{ series: id }` and returned zero rows for every series ever created,
    // and `cancelSeries` ran a `deleteMany` on the same filter and deleted
    // nothing while reporting success.
    series: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MeetingSeries",
      default: null,
    },
    // 1-based index of this meeting within its series; the sort key for
    // `getSeriesMeetings`.
    seriesOccurrence: {
      type: Number,
      default: null,
      min: 1,
    },
    externalCalendarRefs: [
      {
        provider: { type: String, enum: ["google", "outlook"], required: true },
        eventId: { type: String, required: true },
      },
    ],

    // Calendar integration - store external event IDs for both providers
    calendarEvents: {
      google: {
        eventId: { type: String, default: null },
        syncedAt: { type: Date, default: null },
      },
      microsoft: {
        eventId: { type: String, default: null },
        syncedAt: { type: Date, default: null },
      },
    },

    // Legacy field for backward compatibility
    archived: {
      type: Boolean,
      default: false,
    },

    // Soft-delete lifecycle (Issue #1013)
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletionReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    // Google Calendar integration
    googleEventId: {
      type: String,
      default: null,
    },

    // CRDT Collaborative Editing (Yjs)
    crdtState: {
      type: Buffer, // Serialized Yjs document binary state (Y.encodeStateAsUpdate)
      default: null,
    },
    collaborativeNotes: {
      type: String, // Plain-text snapshot for read-only views and semantic search
      default: "",
    },

    // Overall progress through the agenda (Issue #1159).
    //
    // `agendaTimerController` set this on the document and
    // `getAgendaPacingReport` selected and returned it, but it was never a
    // schema path — so the write was dropped and the read was always
    // `undefined`.
    agendaProgress: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },

    // Pinecone embedding index status (Issue #2084)
    embeddingIndex: {
      status: {
        type: String,
        enum: ["idle", "queued", "running", "succeeded", "failed"],
        default: "idle",
      },
      lastIndexedAt: { type: Date, default: null },
      lastError: { type: String, default: null, maxlength: 500 },
      lastJobId: { type: String, default: null },
    },
    auditNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

meetingSchema.pre("validate", function normalizeAgendaOrder(next) {
  if (this.isModified("agendaItems") || this.isNew) {
    this.agendaItems = normalizeAgendaItems(
      (this.agendaItems || []).map((item) =>
        typeof item.toObject === "function" ? item.toObject() : item,
      ),
    );
  }
  next();
});

// Indexes for query performance
meetingSchema.index({ organization: 1, createdAt: -1 });
meetingSchema.index({ organization: 1, deletedAt: 1, createdAt: -1 });
meetingSchema.index({ uploadedBy: 1, createdAt: -1 });
meetingSchema.index({ status: 1 });
meetingSchema.index({ title: "text", summary: "text" });
// `getSeriesMeetings` filters on `series` and sorts on `seriesOccurrence`
// (Issue #1160); `sparse` keeps the index to the small minority of meetings
// that actually belong to a series.
meetingSchema.index({ series: 1, seriesOccurrence: 1 }, { sparse: true });

const Meeting = mongoose.model("Meeting", meetingSchema);
export default Meeting;
