import { toast } from "react-toastify";
import {
  meetingApi,
  meetingSeriesApi,
  meetingTemplateApi,
  aiSummaryTemplateApi,
} from "../../../services";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { customFieldApi } from "../../../api/customFieldApi";
import { focusTimeApi } from "../../../api/focusTimeApi";
import { calendarAvailabilityApi } from "../../../api/calendarAvailabilityApi";
import resourceBookingApi from "../../../services/resourceBookingApi";
import { attachmentApi } from "../../../services/attachmentApi";
import AppContent from "../../../context/AppContent";
import {
  buildMeetingDraftKey,
  useFormDraft,
} from "../../../hooks/useFormDraft";
import {
  moveAgendaItem,
  normalizeAgendaItems,
} from "../../../utils/agendaOrdering";
import {
  buildScheduleSlot,
  findBusyParticipants,
  findFocusConflicts,
} from "../utils/scheduleConflicts";

const CONFLICT_MODE_STORAGE_KEY = "meet-on-memory:schedule-conflict-mode";

const readConflictMode = () => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return "soft";
    return window.localStorage.getItem(CONFLICT_MODE_STORAGE_KEY) === "hard"
      ? "hard"
      : "soft";
  } catch {
    return "soft";
  }
};

export const buildDuplicateScheduleState = (duplicateData = {}) => ({
  scheduleData: {
    title: duplicateData.title || "",
    description: duplicateData.description || "",
    meetingType: duplicateData.meetingType || "conference",
    date: "",
    time: "",
    duration: duplicateData.duration ?? "",
    location: duplicateData.location || "",
    venue: duplicateData.venue || "",
    venueCoordinates: duplicateData.venueCoordinates || null,
    syncToCalendar: true,
    reminderEnabled: duplicateData.reminderEnabled || false,
    reminderMinutesBefore: duplicateData.reminderMinutesBefore || 30,
    tags: duplicateData.tags || [],
  },
  participants: (duplicateData.participants || []).map(
    (participant, index) => ({
      ...participant,
      id: `duplicate-participant-${index}`,
    }),
  ),
  agendaItems: (duplicateData.agendaItems || []).map((item, index) => ({
    ...item,
    id: `duplicate-agenda-${index}`,
  })),
  metadata: {
    tags: duplicateData.tags || [],
    policyDetails: duplicateData.policyDetails || null,
    recordingType: duplicateData.recordingType || "upload",
  },
});

export const useScheduleMeeting = ({
  mode = "create",
  meetingId = null,
  serverUpdatedAt = null,
} = {}) => {
  const { userData } = useContext(AppContent) ?? {};
  const [scheduleData, setScheduleData] = useState({
    title: "",
    description: "",
    meetingType: "conference",
    date: "",
    time: "",
    duration: "",
    location: "",
    venue: "",
    venueCoordinates: null,
    syncToCalendar: true,
    reminderEnabled: false,
    reminderMinutesBefore: 30,
    recurrencePattern: "none",
    endDate: "",
    tags: [],
  });
  const [participants, setParticipants] = useState([]);
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "" });
  const [agendaItems, setAgendaItems] = useState([]);
  const [newAgenda, setNewAgenda] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [aiSummaryTemplates, setAiSummaryTemplates] = useState([]);
  const [selectedAiSummaryTemplateId, setSelectedAiSummaryTemplateId] =
    useState("");
  const [customFields, setCustomFields] = useState({
    fields: [],
    isValid: true,
  });
  const [duplicateMetadata, setDuplicateMetadata] = useState({
    tags: [],
    policyDetails: null,
    recordingType: "upload",
  });
  const [selectedResources, setSelectedResources] = useState([]);

  const [focusBlocks, setFocusBlocks] = useState([]);
  const [focusConflicts, setFocusConflicts] = useState([]);
  const [busyParticipants, setBusyParticipants] = useState([]);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [conflictCheckError, setConflictCheckError] = useState("");
  const [conflictMode, setConflictModeState] = useState(readConflictMode);

  const userId = userData?._id || userData?.id;
  const organizationId =
    userData?.organization?._id || userData?.organization || null;
  const draftKey = buildMeetingDraftKey({
    userId,
    organizationId,
    mode,
    meetingId,
  });

  const draftValues = useMemo(
    () => ({
      scheduleData,
      participants,
      agendaItems,
      selectedTemplateId,
      selectedAiSummaryTemplateId,
      selectedResources,
    }),
    [
      participants,
      scheduleData,
      agendaItems,
      selectedTemplateId,
      selectedAiSummaryTemplateId,
      selectedResources,
    ],
  );

  const restoreDraftValues = (draft) => {
    if (draft?.scheduleData) setScheduleData(draft.scheduleData);
    if (Array.isArray(draft?.participants)) setParticipants(draft.participants);
    if (Array.isArray(draft?.agendaItems)) setAgendaItems(draft.agendaItems);
    if (Array.isArray(draft?.selectedResources))
      setSelectedResources(draft.selectedResources);
    if (typeof draft?.selectedTemplateId === "string") {
      setSelectedTemplateId(draft.selectedTemplateId);
    }
    if (typeof draft?.selectedAiSummaryTemplateId === "string") {
      setSelectedAiSummaryTemplateId(draft.selectedAiSummaryTemplateId);
    }
  };

  const {
    recoverableDraft,
    lastSavedAt,
    status: draftStatus,
    restoreDraft,
    discardDraft,
    clearDraft,
  } = useFormDraft({
    key: draftKey,
    values: draftValues,
    enabled: Boolean(draftKey) && !loading,
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
    serverUpdatedAt,
    onRestore: restoreDraftValues,
  });

  useEffect(() => {
    let cancelled = false;
    if (userData?.organization) {
      meetingTemplateApi
        .getTemplates(userData.organization._id || userData.organization)
        .then((res) => {
          if (!cancelled && res.data?.success) setTemplates(res.data.templates);
        })
        .catch((err) =>
          console.error("Failed to fetch meeting templates:", err),
        );

      aiSummaryTemplateApi
        .getTemplates()
        .then((res) => {
          if (!cancelled && res.data) {
            setAiSummaryTemplates(res.data);
            if (
              res.data.length > 0 &&
              !draftValues.selectedAiSummaryTemplateId
            ) {
              const defaultTemplate = res.data.find((t) => t.isDefault);
              if (defaultTemplate)
                setSelectedAiSummaryTemplateId(defaultTemplate._id);
            }
          }
        })
        .catch((err) =>
          console.error("Failed to fetch AI summary templates:", err),
        );
    }
    return () => {
      cancelled = true;
    };
  }, [userData, draftValues.selectedAiSummaryTemplateId]);

  useEffect(() => {
    let cancelled = false;

    focusTimeApi
      .getBlocks()
      .then((blocks) => {
        if (!cancelled) setFocusBlocks(Array.isArray(blocks) ? blocks : []);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to fetch focus time blocks:", error);
          setFocusBlocks([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const slot = buildScheduleSlot(
      scheduleData.date,
      scheduleData.time,
      scheduleData.duration,
    );

    if (!slot) {
      setFocusConflicts([]);
      setBusyParticipants([]);
      setCheckingConflicts(false);
      setConflictCheckError("");
      return undefined;
    }

    setFocusConflicts(findFocusConflicts(focusBlocks, slot));

    const attendeeEmails = participants
      .map((participant) => participant?.email?.trim())
      .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

    if (attendeeEmails.length === 0) {
      setBusyParticipants([]);
      setCheckingConflicts(false);
      setConflictCheckError("");
      return undefined;
    }

    let cancelled = false;
    setCheckingConflicts(true);
    setConflictCheckError("");

    const timer = window.setTimeout(async () => {
      try {
        const response = await calendarAvailabilityApi.getFreeBusy({
          attendeeEmails: [...new Set(attendeeEmails)],
          timeMin: slot.start.toISOString(),
          timeMax: slot.end.toISOString(),
        });

        if (!cancelled) {
          setBusyParticipants(
            findBusyParticipants(
              response?.data || response,
              participants,
              slot,
            ),
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to check participant availability:", error);
          setBusyParticipants([]);
          setConflictCheckError(
            "Participant availability could not be checked. You can still schedule unless hard blocking is enabled.",
          );
        }
      } finally {
        if (!cancelled) setCheckingConflicts(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    focusBlocks,
    participants,
    scheduleData.date,
    scheduleData.time,
    scheduleData.duration,
  ]);

  const setConflictMode = useCallback((modeValue) => {
    const nextMode = modeValue === "hard" ? "hard" : "soft";
    setConflictModeState(nextMode);
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(CONFLICT_MODE_STORAGE_KEY, nextMode);
      }
    } catch {
      // Ignore storage failures (private mode / missing localStorage in tests)
    }
  }, []);

  const hydrateDuplicateMeeting = useCallback((duplicateData) => {
    const duplicated = buildDuplicateScheduleState(duplicateData);
    setScheduleData(duplicated.scheduleData);
    setParticipants(duplicated.participants);
    setAgendaItems(duplicated.agendaItems);
    setSelectedTemplateId("");
    setDuplicateMetadata(duplicated.metadata);
  }, []);

  const handleTemplateSelect = (e) => {
    const templateId = e.target.value;
    setSelectedTemplateId(templateId);

    if (templateId) {
      const template = templates.find((t) => t._id === templateId);
      if (template) {
        const newBlocks = template.agendaBlocks.map((block) => ({
          text: block.title,
          description: block.description,
          duration: block.duration,
          id: Date.now().toString() + Math.random(),
        }));
        setAgendaItems(newBlocks);
        setAgendaItems(normalizeAgendaItems(newBlocks));
        toast.info("Template agenda applied");
      }
    }
  };

  const handleScheduleChange = (e) => {
    const { name, value } = e.target;
    setScheduleData((prev) => ({ ...prev, [name]: value }));
  };

  const addParticipant = () => {
    if (newParticipant.name.trim() && newParticipant.email.trim()) {
      setParticipants([...participants, { ...newParticipant, id: Date.now() }]);
      setNewParticipant({ name: "", email: "" });
      toast.success("Participant added");
    } else {
      toast.error("Please enter both name and email");
    }
  };

  const removeParticipant = (id) => {
    setParticipants(participants.filter((p) => p.id !== id));
  };

  const addAgendaItem = () => {
    if (newAgenda.trim()) {
      setAgendaItems((current) =>
        normalizeAgendaItems([
          ...current,
          { text: newAgenda, id: crypto.randomUUID?.() || String(Date.now()) },
        ]),
      );
      setNewAgenda("");
      toast.success("Agenda item added");
    }
  };

  const removeAgendaItem = (id) => {
    setAgendaItems((current) =>
      normalizeAgendaItems(current.filter((a) => a.id !== id)),
    );
  };

  const reorderAgendaItem = (fromIndex, toIndex) => {
    setAgendaItems((current) => moveAgendaItem(current, fromIndex, toIndex));
  };

  const handleAttachmentUpload = (e) => {
    const files = Array.from(e.target.files);
    setAttachments([...attachments, ...files]);
    toast.success(`${files.length} file(s) attached`);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const resetScheduleForm = () => {
    setScheduleData({
      title: "",
      description: "",
      meetingType: "conference",
      date: "",
      time: "",
      duration: "",
      location: "",
      venue: "",
      venueCoordinates: null,
      syncToCalendar: true,
      reminderEnabled: false,
      reminderMinutesBefore: 30,
      recurrencePattern: "none",
      endDate: "",
    });
    setParticipants([]);
    setAgendaItems([]);
    setAttachments([]);
    setDuplicateMetadata({
      tags: [],
      policyDetails: null,
      recordingType: "upload",
    });
    setSelectedTemplateId("");
    setFocusConflicts([]);
    setBusyParticipants([]);
    setSelectedResources([]);
    clearDraft();
  };

  const handleScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!scheduleData.title.trim()) {
      toast.error("Meeting title is required");
      return;
    }

    if (!scheduleData.date || !scheduleData.time) {
      toast.error("Date and time are required");
      return;
    }

    const recurrencePattern = scheduleData.recurrencePattern || "none";
    const isRecurring =
      Boolean(recurrencePattern) && recurrencePattern !== "none";

    if (isRecurring) {
      if (!scheduleData.endDate) {
        toast.error("End date is required for recurring meetings");
        return;
      }
      if (scheduleData.date > scheduleData.endDate) {
        toast.error("Start date must be before or equal to end date");
        return;
      }
    }

    const hasConflicts =
      focusConflicts.length > 0 || busyParticipants.length > 0;
    if (hasConflicts && conflictMode === "hard") {
      toast.error(
        "Resolve the schedule conflict or switch Conflict behavior to Warn only.",
      );
      return;
    }

    if (checkingConflicts && conflictMode === "hard") {
      toast.error(
        "Please wait for participant availability to finish checking.",
      );
      return;
    }

    let auditNote;
    if (focusConflicts.length > 0 && conflictMode !== "hard") {
      const confirmed = window.confirm(
        "This meeting overlaps with a focus time block. Schedule anyway?",
      );
      if (!confirmed) return;

      const reason = window.prompt(
        "Please provide a reason for overriding focus time:",
      );
      if (!reason || !reason.trim()) {
        toast.error(
          "An override reason is required to schedule over focus time",
        );
        return;
      }
      auditNote = reason.trim();
    }

    setLoading(true);
    try {
      const selectedTags =
        Array.isArray(scheduleData.tags) && scheduleData.tags.length > 0
          ? scheduleData.tags
          : duplicateMetadata.tags || [];

      const payload = {
        ...scheduleData,
        participants,
        tags: selectedTags,
        metadata: {
          tags: selectedTags,
        },
        policyDetails: duplicateMetadata.policyDetails,
        recordingType: duplicateMetadata.recordingType,
        agendaItems: normalizeAgendaItems(agendaItems),
        ...(auditNote ? { auditNote } : {}),
      };

      if (isRecurring) {
        const seriesPayload = {
          ...payload,
          startDate: scheduleData.date,
          endDate: scheduleData.endDate,
          recurrencePattern,
        };
        const response = await meetingSeriesApi.createSeries(seriesPayload);
        if (response.data?.success) {
          const count = response.data.meetingsCreated ?? 0;
          toast.success(
            `Meeting series created successfully with ${count} occurrence(s)!`,
          );
          resetScheduleForm();
        } else {
          toast.error(
            response.data?.message || "Failed to create meeting series",
          );
        }
        return;
      }

      const response = await meetingApi.scheduleMeeting(payload);

      if (response.data?.success) {
        if (customFields.fields.length > 0 && userData?.organization) {
          try {
            await customFieldApi.setMeetingFields(
              response.data.meeting._id,
              userData.organization,
              customFields.fields,
            );
          } catch (err) {
            console.error("Failed to save custom fields", err);
            toast.error("Meeting saved, but custom fields failed to save");
          }
        }

        if (
          selectedResources &&
          selectedResources.length > 0 &&
          userData?.organization
        ) {
          const orgId = userData.organization._id || userData.organization;
          const slot = buildScheduleSlot(
            scheduleData.date,
            scheduleData.time,
            scheduleData.duration,
          );
          if (slot) {
            for (const resourceId of selectedResources) {
              try {
                await resourceBookingApi.createBooking(orgId, {
                  resourceId,
                  meetingId: response.data.meeting._id,
                  startTime: slot.start.toISOString(),
                  endTime: slot.end.toISOString(),
                });
              } catch (err) {
                console.error("Failed to book resource", err);
                toast.error(
                  `Failed to book a selected physical resource: ${err.response?.data?.message || err.message}`,
                );
              }
            }
          }
        }

        if (attachments.length > 0 && response.data.meeting?._id) {
          for (const file of attachments) {
            const formData = new FormData();
            formData.append("file", file);
            try {
              await attachmentApi.uploadAttachment(
                response.data.meeting._id,
                formData,
              );
            } catch (err) {
              console.error("Failed to upload attachment", err);
              toast.error(
                `Meeting saved, but failed to upload ${file.name || "attachment"}`,
              );
            }
          }
        }

        toast.success("✅ Meeting scheduled and synced to calendars!");

        if (response.data.calendarLinks) {
          toast.info("📅 Calendar invites sent to all participants!");
        }

        resetScheduleForm();
      } else {
        toast.error(response.data?.message || "Failed to schedule meeting");
      }
    } catch (error) {
      console.error("Error scheduling meeting:", error);
      toast.error(
        error.response?.data?.message || "Unable to schedule meeting",
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    scheduleData,
    setScheduleData,
    participants,
    newParticipant,
    setNewParticipant,
    agendaItems,
    newAgenda,
    setNewAgenda,
    attachments,
    loading,
    templates,
    selectedTemplateId,
    aiSummaryTemplates,
    selectedAiSummaryTemplateId,
    setSelectedAiSummaryTemplateId,
    handleTemplateSelect,
    handleScheduleChange,
    addParticipant,
    removeParticipant,
    addAgendaItem,
    removeAgendaItem,
    reorderAgendaItem,
    handleAttachmentUpload,
    removeAttachment,
    handleScheduleSubmit,
    hydrateDuplicateMeeting,
    recoverableDraft,
    lastSavedAt,
    draftStatus,
    restoreDraft,
    discardDraft,
    setAgendaItems,
    customFields,
    setCustomFields,
    userData,
    focusConflicts,
    busyParticipants,
    checkingConflicts,
    conflictCheckError,
    conflictMode,
    setConflictMode,
    selectedResources,
    setSelectedResources,
  };
};
