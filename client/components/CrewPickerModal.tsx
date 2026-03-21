import React, { useState, useCallback } from "react";
import { View, StyleSheet, Modal, Pressable, FlatList, ActivityIndicator, TextInput, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  primaryRole: string;
  locationId: string;
}

interface CrewPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (staffMember: StaffMember) => void;
  title?: string;
}

const ROLE_LABELS: Record<string, string> = {
  autista: "Autista",
  soccorritore: "Soccorritore",
  infermiere: "Infermiere",
  medico: "Medico",
  coordinatore: "Coordinatore",
  tirocinante: "Tirocinante",
};

export function CrewPickerModal({ visible, onClose, onSelect, title = "Chi si iscrive?" }: CrewPickerModalProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: staffMembers, isLoading } = useQuery<StaffMember[]>({
    queryKey: [`/api/staff-members?isActive=true`],
    enabled: visible,
  });

  const filteredMembers = staffMembers?.filter((member) => {
    if (!searchQuery.trim()) return true;
    const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase());
  }) || [];

  const handleSelect = useCallback((member: StaffMember) => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSelect(member);
    setSearchQuery("");
  }, [onSelect]);

  const handleClose = useCallback(() => {
    setSearchQuery("");
    onClose();
  }, [onClose]);

  const renderMemberItem = useCallback(({ item }: { item: StaffMember }) => (
    <Pressable
      style={[styles.memberItem, { backgroundColor: theme.cardBackground }]}
      onPress={() => handleSelect(item)}
    >
      <View style={[styles.avatar, { backgroundColor: theme.primary + "20" }]}>
        <ThemedText style={{ color: theme.primary, fontWeight: "600" }}>
          {item.firstName.charAt(0)}{item.lastName.charAt(0)}
        </ThemedText>
      </View>
      <View style={styles.memberInfo}>
        <ThemedText type="label">{item.firstName} {item.lastName}</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {ROLE_LABELS[item.primaryRole] || item.primaryRole}
        </ThemedText>
      </View>
      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
    </Pressable>
  ), [theme, handleSelect]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.header}>
          <ThemedText type="h3">{title}</ThemedText>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          <Feather name="search" size={18} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Cerca per nome..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="words"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : filteredMembers.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md, textAlign: "center" }}>
              {searchQuery ? "Nessun risultato" : "Nessun membro registrato.\nRegistrati dal menu Profilo."}
            </ThemedText>
          </View>
        ) : (
          <FlatList
            data={filteredMembers}
            keyExtractor={(item) => item.id}
            renderItem={renderMemberItem}
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          />
        )}
      </ThemedView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  memberInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
});
