import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { useAuth } from "@clerk/clerk-react";

// Helper function to build API request URL
const buildApiUrl = (meetingId, endpoint = "") =>
  `/api/meeting-retrospectives/${meetingId}${endpoint}`;

export const useRetrospective = (meetingId) => {
  const { getToken } = useAuth();

  return useQuery({
    queryKey: ["meetingRetrospective", meetingId],
    queryFn: async () => {
      if (!meetingId) return null;

      const token = await getToken();
      const response = await fetch(buildApiUrl(meetingId), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch retrospective");
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!meetingId,
  });
};

export const useSubmitRetrospective = (meetingId) => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      const token = await getToken();
      const response = await fetch(buildApiUrl(meetingId, "/submissions"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to submit retrospective");
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(["meetingRetrospective", meetingId], newData);
      toast.success("Retrospective submitted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit retrospective");
    },
  });
};

export const useUpvoteRetrospectiveItem = (meetingId) => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ submissionId, type }) => {
      const token = await getToken();
      const response = await fetch(
        buildApiUrl(meetingId, `/submissions/${submissionId}/upvote`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ type }),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to upvote item");
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(["meetingRetrospective", meetingId], newData);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to upvote item");
    },
  });
};

export const useGenerateRetrospectiveAiThemes = (meetingId) => {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getToken();
      const response = await fetch(buildApiUrl(meetingId, "/ai-themes"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to generate AI themes");
      }

      const result = await response.json();
      return result.data;
    },
    onSuccess: (newData) => {
      queryClient.setQueryData(["meetingRetrospective", meetingId], newData);
      toast.success("AI themes generated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to generate AI themes");
    },
  });
};
