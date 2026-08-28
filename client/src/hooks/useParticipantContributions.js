import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getMeetingContributions,
  calculateMeetingContributions,
} from "../api/participantContributionApi";

export const useMeetingContributions = (meetingId) => {
  return useQuery({
    queryKey: ["meetingContributions", meetingId],
    queryFn: () => getMeetingContributions(meetingId),
    enabled: !!meetingId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCalculateMeetingContributions = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (meetingId) => calculateMeetingContributions(meetingId),
    onSuccess: (data, meetingId) => {
      queryClient.setQueryData(["meetingContributions", meetingId], data);
    },
  });
};
