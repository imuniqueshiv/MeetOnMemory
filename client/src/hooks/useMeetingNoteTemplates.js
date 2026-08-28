import { useState, useCallback } from "react";
import api from "../services/apiClient.js";

/**
 * @desc Hook for fetching and applying note templates.
 */
export const useMeetingNoteTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data } = await api.get("/api/note-templates");
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch note templates");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const applyTemplate = useCallback(async (templateId) => {
    try {
      const { data } = await api.post(
        `/api/note-templates/${templateId}/apply`,
      );
      return data.markdown;
    } catch (err) {
      console.error("Apply template failed:", err);
      return null;
    }
  }, []);

  return {
    templates,
    isLoading,
    error,
    fetchTemplates,
    applyTemplate,
  };
};
