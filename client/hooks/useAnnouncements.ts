import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, getApiUrl, getQueryFn } from '@/lib/query-client';
import type { Announcement } from '@shared/schema';

export function useAnnouncements() {
  return useQuery<Announcement[] | null>({
    queryKey: ['/api/announcements'],
    queryFn: getQueryFn<Announcement[] | null>({ on401: 'returnNull' }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useMarkAnnouncementRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      const url = new URL(`/api/announcements/${announcementId}/read`, getApiUrl());
      return apiRequest('POST', url.toString());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
    },
  });
}

export function useUnreadAnnouncements() {
  const { data: announcements, ...rest } = useAnnouncements();
  
  // Filter to only show active, non-expired, unread announcements
  const unreadAnnouncements = announcements?.filter((a) => {
    if (!a.isActive) return false;
    if (a.expiresAt && new Date(a.expiresAt) < new Date()) return false;
    // The API already filters for unread based on the user's session
    return true;
  }) || [];

  return {
    data: unreadAnnouncements,
    ...rest,
  };
}
