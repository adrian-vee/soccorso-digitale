import React, { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useUnreadAnnouncements, useMarkAnnouncementRead } from '@/hooks/useAnnouncements';
import { useTheme } from '@/hooks/useTheme';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { Feather } from '@expo/vector-icons';
import type { Announcement } from '@shared/schema';

type ColorTheme = typeof Colors.light;

export function AnnouncementBanner() {
  const { data: announcements, isLoading } = useUnreadAnnouncements();
  const markRead = useMarkAnnouncementRead();
  const { theme, isDark } = useTheme();
  const colors: ColorTheme = isDark ? Colors.dark : Colors.light;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading || !announcements || announcements.length === 0) {
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return colors.error;
      case 'high':
        return colors.warning;
      default:
        return colors.primary;
    }
  };

  const getPriorityIcon = (priority: string): keyof typeof Feather.glyphMap => {
    switch (priority) {
      case 'urgent':
        return 'alert-triangle';
      case 'high':
        return 'alert-circle';
      default:
        return 'info';
    }
  };

  const handleConfirmRead = async (announcement: Announcement) => {
    try {
      await markRead.mutateAsync(announcement.id);
      setExpandedId(null);
    } catch (error) {
      console.error('Failed to mark announcement as read:', error);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View style={styles.container}>
      {announcements.map((announcement) => {
        const priorityColor = getPriorityColor(announcement.priority);
        const isExpanded = expandedId === announcement.id;
        
        return (
          <Card key={announcement.id} style={StyleSheet.flatten([styles.banner, { borderLeftColor: priorityColor }])}>
            <Pressable
              style={styles.bannerHeader}
              onPress={() => toggleExpand(announcement.id)}
            >
              <View style={styles.iconContainer}>
                <Feather
                  name={getPriorityIcon(announcement.priority)}
                  size={20}
                  color={priorityColor}
                />
              </View>
              <View style={styles.titleContainer}>
                <ThemedText style={styles.title} numberOfLines={1}>
                  {announcement.title}
                </ThemedText>
                {announcement.priority === 'urgent' ? (
                  <View style={[styles.priorityBadge, { backgroundColor: colors.error + '20' }]}>
                    <ThemedText style={[styles.priorityText, { color: colors.error }]}>
                      Urgente
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <Feather
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>

            {isExpanded ? (
              <View style={styles.expandedContent}>
                <ThemedText style={styles.content}>
                  {announcement.content}
                </ThemedText>
                <Pressable
                  style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                  onPress={() => handleConfirmRead(announcement)}
                  disabled={markRead.isPending}
                >
                  {markRead.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.confirmButtonText}>
                      Ho letto, conferma
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  banner: {
    borderLeftWidth: 4,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  expandedContent: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  confirmButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    minWidth: 120,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
