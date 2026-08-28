import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { sessionCardApi } from "../../../services";

export const useSessionCards = () => {
  const [sessionData, setSessionData] = useState({
    eventName: "",
    sessionTitle: "",
    speaker: "",
    speakerBio: "",
    speakerTitle: "",
  });
  const [slideFiles, setSlideFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null);
  const [generatedSessions, setGeneratedSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCards, setFetchingCards] = useState(false);

  const fetchSessionCards = useCallback(async () => {
    setFetchingCards(true);
    try {
      const response = await sessionCardApi.getSessionCards({ limit: 50 });
      if (response.data?.success) {
        const list = Array.isArray(response.data?.sessions)
          ? response.data.sessions
          : Array.isArray(response.data?.data?.sessions)
            ? response.data.data.sessions
            : [];
        setGeneratedSessions(list);
      }
    } catch (error) {
      console.error("Error loading session cards:", error);
    } finally {
      setFetchingCards(false);
    }
  }, []);

  useEffect(() => {
    fetchSessionCards();
  }, [fetchSessionCards]);

  const handleSessionChange = (e) => {
    const { name, value } = e.target;
    setSessionData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSlideUpload = (e) => {
    const files = Array.from(e.target.files);
    setSlideFiles((prev) => [...prev, ...files]);
    toast.success(`${files.length} slide file(s) uploaded`);
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      toast.success(`Video "${file.name}" selected`);
    }
  };

  const removeSlideFile = (index) => {
    setSlideFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteSession = async (sessionId) => {
    if (!sessionId) return;
    try {
      const response = await sessionCardApi.deleteSessionCard(sessionId);
      if (response.data?.success || response.status === 200) {
        setGeneratedSessions((prev) =>
          prev.filter((s) => s._id !== sessionId && s.id !== sessionId),
        );
        toast.success("Session card deleted successfully");
      }
    } catch (error) {
      console.error("Error deleting session card:", error);
      toast.error(
        error.response?.data?.message || "Failed to delete session card",
      );
    }
  };

  const handleSessionSubmit = async (e) => {
    e.preventDefault();
    if (!sessionData.sessionTitle.trim() || slideFiles.length === 0) {
      toast.error("Session title and at least one slide file are required");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("eventName", sessionData.eventName);
      formData.append("sessionTitle", sessionData.sessionTitle);
      formData.append("speaker", sessionData.speaker);
      formData.append("speakerBio", sessionData.speakerBio);
      formData.append("speakerTitle", sessionData.speakerTitle);

      slideFiles.forEach((file) => {
        formData.append("slides", file);
      });

      if (videoFile) {
        formData.append("video", videoFile);
      }

      const response = await sessionCardApi.generateSession(formData);

      if (response.data?.success) {
        toast.success("✨ AI Session card generated and saved successfully!");
        const newSession =
          response.data?.data?.session || response.data?.session;
        if (newSession) {
          setGeneratedSessions((prev) => [newSession, ...prev]);
        } else {
          fetchSessionCards();
        }

        // Reset form
        setSessionData({
          eventName: "",
          sessionTitle: "",
          speaker: "",
          speakerBio: "",
          speakerTitle: "",
        });
        setSlideFiles([]);
        setVideoFile(null);
      } else {
        toast.error(response.data?.message || "Failed to create session");
      }
    } catch (error) {
      console.error("Error creating session:", error);
      toast.error(error.response?.data?.message || "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return {
    sessionData,
    slideFiles,
    videoFile,
    generatedSessions,
    loading,
    fetchingCards,
    fetchSessionCards,
    handleSessionChange,
    handleSlideUpload,
    handleVideoUpload,
    removeSlideFile,
    handleDeleteSession,
    handleSessionSubmit,
  };
};
