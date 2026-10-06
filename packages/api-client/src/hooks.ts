import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import type { operations } from "./schema";

export type UpdateMeInput = NonNullable<operations["updateMe"]["requestBody"]>["content"]["application/json"];

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/me", {});
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<UpdateMeInput>) => {
      const { data, error } = await api.PATCH("/api/me", { body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useUpdateTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tags: string[]) => {
      const { data, error } = await api.PUT("/api/me/tags", { body: { tags } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { latitude: number; longitude: number; source: "gps" | "manual"; label?: string }) => {
      const { error } = await api.PUT("/api/me/location", { body: input });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useUploadPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data, error } = await api.POST("/api/me/photos", { body: form as never });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useDeletePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: number) => {
      const { error } = await api.DELETE("/api/me/photos/{photoId}", { params: { path: { photoId } } });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useSetProfilePicture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (photoId: number) => {
      const { error } = await api.PUT("/api/me/photos/{photoId}/profile-picture", {
        params: { path: { photoId } },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useVisitors() {
  return useQuery({
    queryKey: ["visitors"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/me/visitors", {});
      if (error) throw error;
      return data;
    },
  });
}

export function useLikers() {
  return useQuery({
    queryKey: ["likers"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/me/likers", {});
      if (error) throw error;
      return data;
    },
  });
}

export function useUserProfile(userId: number) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/users/{userId}", { params: { path: { userId } } });
      if (error) throw error;
      return data;
    },
    enabled: Number.isFinite(userId),
  });
}

/** Must match PAGE_SIZE in apps/api/app/matching/service.py. */
export const BROWSE_PAGE_SIZE = 60;

export interface BrowseFilters {
  min_age?: number;
  max_age?: number;
  min_fame?: number;
  max_fame?: number;
  location?: string;
  tags?: string;
  sort?: "age" | "location" | "fame_rating" | "tags";
  /** Pagination cursor for "Load more" -- browse/search return one page (see
   * PAGE_SIZE server-side) at a time, not the whole matching pool. */
  offset?: number;
}

export function useBrowse(filters: BrowseFilters) {
  return useQuery({
    queryKey: ["browse", filters],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/browse", { params: { query: filters } });
      if (error) throw error;
      return data;
    },
  });
}

export function useSearch(filters: BrowseFilters) {
  return useQuery({
    queryKey: ["search", filters],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/search", { params: { query: filters } });
      if (error) throw error;
      return data;
    },
  });
}

function invalidateProfileQueries(queryClient: ReturnType<typeof useQueryClient>, userId: number) {
  queryClient.invalidateQueries({ queryKey: ["user", userId] });
  queryClient.invalidateQueries({ queryKey: ["browse"] });
  queryClient.invalidateQueries({ queryKey: ["search"] });
  queryClient.invalidateQueries({ queryKey: ["likers"] });
  queryClient.invalidateQueries({ queryKey: ["me"] });
}

export function useLikeUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: number) => {
      const { data, error } = await api.POST("/api/users/{userId}/like", { params: { path: { userId } } });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, userId) => invalidateProfileQueries(queryClient, userId),
  });
}

export function useUnlikeUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: number) => {
      const { error } = await api.DELETE("/api/users/{userId}/like", { params: { path: { userId } } });
      if (error) throw error;
    },
    onSuccess: (_data, userId) => invalidateProfileQueries(queryClient, userId),
  });
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: number) => {
      const { error } = await api.POST("/api/users/{userId}/block", { params: { path: { userId } } });
      if (error) throw error;
    },
    onSuccess: (_data, userId) => invalidateProfileQueries(queryClient, userId),
  });
}

export function useReportUser() {
  return useMutation({
    mutationFn: async ({ userId, reason }: { userId: number; reason: string }) => {
      const { error } = await api.POST("/api/users/{userId}/report", {
        params: { path: { userId } },
        body: { reason: reason as never },
      });
      if (error) throw error;
    },
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/notifications", {});
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await api.POST("/api/notifications/read-all", {});
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useConversations() {
  return useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/conversations", {});
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });
}

export function useMessages(peerId: number) {
  return useQuery({
    queryKey: ["messages", peerId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/conversations/{peerId}/messages", {
        params: { path: { peerId } },
      });
      if (error) throw error;
      return data;
    },
    enabled: Number.isFinite(peerId),
    refetchInterval: 3000,
  });
}

export function useSendMessage(peerId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { data, error } = await api.POST("/api/conversations/{peerId}/messages", {
        params: { path: { peerId } },
        body: { body },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", peerId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export type ProposeDateInput = operations["proposeDate"]["requestBody"]["content"]["application/json"];

// Bonus feature: schedule/organize real-life dates between matched users.
export function useDates(peerId: number) {
  return useQuery({
    queryKey: ["dates", peerId],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/dates/{peerId}", { params: { path: { peerId } } });
      if (error) throw error;
      return data;
    },
    enabled: Number.isFinite(peerId),
  });
}

export function useProposeDate(peerId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProposeDateInput) => {
      const { data, error } = await api.POST("/api/dates/{peerId}", { params: { path: { peerId } }, body: input });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dates", peerId] }),
  });
}

export function useRespondToDate(peerId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ dateId, status }: { dateId: number; status: "accepted" | "declined" }) => {
      const { data, error } = await api.POST("/api/dates/{dateId}/respond", {
        params: { path: { dateId } },
        body: { status },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dates", peerId] }),
  });
}

export function useCancelDate(peerId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dateId: number) => {
      const { error } = await api.DELETE("/api/dates/{dateId}", { params: { path: { dateId } } });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dates", peerId] }),
  });
}
