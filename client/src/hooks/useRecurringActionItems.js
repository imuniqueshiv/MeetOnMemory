import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getRecurringActionItems,
  getRecurringActionItemById,
  createRecurringActionItem,
  updateRecurringActionItem,
  deleteRecurringActionItem,
} from "../api/recurringActionItemApi";

export const useRecurringActionItems = () => {
  return useQuery({
    queryKey: ["recurringActionItems"],
    queryFn: getRecurringActionItems,
  });
};

export const useRecurringActionItem = (id) => {
  return useQuery({
    queryKey: ["recurringActionItem", id],
    queryFn: () => getRecurringActionItemById(id),
    enabled: !!id,
  });
};

export const useCreateRecurringActionItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createRecurringActionItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringActionItems"] });
    },
  });
};

export const useUpdateRecurringActionItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateRecurringActionItem(id, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["recurringActionItems"] });
      queryClient.invalidateQueries({
        queryKey: ["recurringActionItem", variables.id],
      });
    },
  });
};

export const useDeleteRecurringActionItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRecurringActionItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringActionItems"] });
    },
  });
};
