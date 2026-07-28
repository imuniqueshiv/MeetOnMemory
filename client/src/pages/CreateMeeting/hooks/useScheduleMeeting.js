import { useState } from "react";
import { toast } from "react-toastify";
import {
  meetingApi,
  meetingTemplateApi,
  meetingSeriesApi,
} from "../../../services";
import { useEffect } from "react";

export const useScheduleMeeting = () => {
  const [scheduleData, setScheduleData] = useState({
    title: "",
    description: "",
    meetingType: "conference",
    date: "",
    time: "",
    duration: "",
    location: "",
    venue: "",
    syncToCalendar: true,
    recurrencePattern: "none",
    endDate: "",
    dayOfWeek: "",
    dayOfMonth: "",
  });
  const [participants, setParticipants] = useState([]);
  const [newParticipant, setNewParticipant] = useState({ name: "", email: "" });
  const [agendaItems, setAgendaItems] = useState([]);
  const [newAgenda, setNewAgenda] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const res = await meetingTemplateApi.getTemplates();
        if (res.data?.success) {
          setTemplates(res.data.templates);
        }
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      }
    };
    fetchTemplates();
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
      setAgendaItems([...agendaItems, { text: newAgenda, id: Date.now() }]);
      setNewAgenda("");
      toast.success("Agenda item added");
    }
  };

  const removeAgendaItem = (id) => {
    setAgendaItems(agendaItems.filter((a) => a.id !== id));
  };

  const handleAttachmentUpload = (e) => {
    const files = Array.from(e.target.files);
    setAttachments([...attachments, ...files]);
    toast.success(`${files.length} file(s) attached`);
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
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

    setLoading(true);
    try {
      const payload = {
        ...scheduleData,
        participants,
        agendaItems,
      };

      // Type-cast specific fields for meeting series if needed
      if (
        scheduleData.recurrencePattern &&
        scheduleData.recurrencePattern !== "none"
      ) {
        payload.dayOfWeek = scheduleData.dayOfWeek
          ? parseInt(scheduleData.dayOfWeek, 10)
          : undefined;
        payload.dayOfMonth = scheduleData.dayOfMonth
          ? parseInt(scheduleData.dayOfMonth, 10)
          : undefined;
      }

      const response =
        scheduleData.recurrencePattern &&
        scheduleData.recurrencePattern !== "none"
          ? await meetingSeriesApi.createSeries(payload)
          : await meetingApi.scheduleMeeting(payload);

      if (response.data?.success) {
        toast.success(
          scheduleData.recurrencePattern &&
            scheduleData.recurrencePattern !== "none"
            ? "✅ Meeting series scheduled successfully!"
            : "✅ Meeting scheduled and synced to calendars!",
        );

        // Trigger calendar integration
        if (response.data.calendarLinks) {
          toast.info("📅 Calendar invites sent to all participants!");
        }

        // Reset form
        setScheduleData({
          title: "",
          description: "",
          meetingType: "conference",
          date: "",
          time: "",
          duration: "",
          location: "",
          venue: "",
          syncToCalendar: true,
          recurrencePattern: "none",
          endDate: "",
          dayOfWeek: "",
          dayOfMonth: "",
        });
        setParticipants([]);
        setAgendaItems([]);
        setAttachments([]);
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
    handleTemplateSelect,
    handleScheduleChange,
    addParticipant,
    removeParticipant,
    addAgendaItem,
    removeAgendaItem,
    handleAttachmentUpload,
    removeAttachment,
    handleScheduleSubmit,
  };
};
