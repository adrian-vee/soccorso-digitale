import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  View, 
  StyleSheet, 
  Pressable, 
  FlatList, 
  TextInput, 
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { AmbulanceIcon } from "@/components/AmbulanceIcon";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/contexts/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, getApiUrl, getAuthToken } from "@/lib/query-client";

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderVehicleId: string | null;
  senderVehicleCode: string | null;
  senderLocationId: string | null;
  senderLocationName: string | null;
  message: string;
  messageType: string;
  isPriority: boolean;
  createdAt: string;
}

interface MessageReader {
  userId: string;
  vehicleCode: string | null;
  readAt: string;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const selectedVehicle = user?.vehicle || null;
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [messageText, setMessageText] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [readers, setReaders] = useState<MessageReader[]>([]);
  const [loadingReaders, setLoadingReaders] = useState(false);

  const { data: messages = [], isLoading, refetch } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages"],
    queryFn: async () => {
      const url = new URL("/api/chat/messages?limit=100", getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (!res.ok) throw new Error("Errore caricamento messaggi");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, vehicleId }: { text: string; vehicleId?: string }) => {
      return apiRequest("POST", "/api/chat/messages", {
        message: text,
        vehicleId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      setMessageText("");
    },
  });

  useEffect(() => {
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const connectWebSocket = () => {
      if (reconnectAttempts >= maxReconnectAttempts) {
        return;
      }
      
      try {
        const baseUrl = getApiUrl();
        const wsUrl = baseUrl.replace(/^http/, "ws") + "/ws/chat";
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          reconnectAttempts = 0;
          setIsConnected(true);
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "new_message") {
              queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          } catch (e) {
            // Ignore parse errors silently
          }
        };
        
        ws.onclose = () => {
          setIsConnected(false);
          reconnectAttempts++;
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectTimeout = setTimeout(connectWebSocket, 10000);
          }
        };
        
        ws.onerror = () => {
          // Silently handle WebSocket errors - will fallback to polling
        };
        
        wsRef.current = ws;
      } catch (error) {
        // Silently handle connection errors
        reconnectAttempts++;
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [queryClient]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
      // Mark messages from others as read
      const otherMessages = messages.filter(m => m.senderId !== user?.id);
      if (otherMessages.length > 0) {
        const messageIds = otherMessages.map(m => m.id);
        apiRequest("POST", "/api/chat/read", { messageIds }).catch(() => {});
      }
    }
  }, [messages.length, user?.id]);

  const loadMessageReaders = useCallback(async (messageId: string) => {
    setLoadingReaders(true);
    setSelectedMessageId(messageId);
    try {
      const url = new URL(`/api/chat/messages/${messageId}/readers`, getApiUrl());
      const token = await getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { credentials: "include", headers });
      if (res.ok) {
        const data = await res.json();
        setReaders(data);
      }
    } catch (error) {
      // Ignore errors
    } finally {
      setLoadingReaders(false);
    }
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!messageText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    sendMessageMutation.mutate({ 
      text: messageText.trim(), 
      vehicleId: selectedVehicle?.id 
    });
  }, [messageText, sendMessageMutation, selectedVehicle?.id]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Oggi";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Ieri";
    } else {
      return date.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
    }
  };

  const isOwnMessage = (msg: ChatMessage) => msg.senderId === user?.id;

  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn = isOwnMessage(item);
    const showDateHeader = index === 0 || 
      formatDate(messages[index - 1]?.createdAt) !== formatDate(item.createdAt);
    
    const messageBubble = (
      <View style={[
        styles.messageBubble,
        isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
        { backgroundColor: isOwn ? "#1F6FEB" : "#2D4A3E" },
        item.isPriority ? styles.priorityMessage : null,
      ]}>
        {!isOwn ? (
          <View style={styles.senderInfo}>
            {item.senderVehicleCode ? (
              <ThemedText style={[styles.senderVehicleLabel, { color: "#4CAF50" }]}>
                {item.senderVehicleCode}
              </ThemedText>
            ) : item.senderLocationName ? (
              <ThemedText style={[styles.senderVehicleLabel, { color: "#FF9800" }]}>
                {item.senderLocationName}
              </ThemedText>
            ) : (
              <ThemedText style={[styles.senderVehicleLabel, { color: "#9E9E9E" }]}>
                Admin
              </ThemedText>
            )}
          </View>
        ) : null}
        
        <ThemedText style={[
          styles.messageText,
          { color: isOwn ? "#FFFFFF" : theme.text }
        ]}>
          {item.message}
        </ThemedText>
        
        <View style={styles.messageFooter}>
          <ThemedText style={[
            styles.messageTime,
            { color: isOwn ? "rgba(255,255,255,0.7)" : theme.textSecondary }
          ]}>
            {formatTime(item.createdAt)}
          </ThemedText>
          {isOwn ? (
            <Feather name="check" size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
          ) : null}
          {item.isPriority ? (
            <Feather name="alert-circle" size={12} color="#FF6B6B" style={{ marginLeft: 4 }} />
          ) : null}
        </View>
        {isOwn ? (
          <ThemedText style={styles.tapToSeeReaders}>
            Tocca per vedere chi ha letto
          </ThemedText>
        ) : null}
      </View>
    );
    
    return (
      <View>
        {showDateHeader ? (
          <View style={styles.dateHeader}>
            <ThemedText style={[styles.dateHeaderText, { color: theme.textSecondary }]}>
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>
        ) : null}
        
        <View style={[
          styles.messageRow,
          isOwn ? styles.messageRowOwn : styles.messageRowOther
        ]}>
          {isOwn ? (
            <Pressable onPress={() => loadMessageReaders(item.id)}>
              {messageBubble}
            </Pressable>
          ) : messageBubble}
        </View>
      </View>
    );
  }, [messages, user?.id, theme, loadMessageReaders]);

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
            Caricamento messaggi...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
      >
        <View style={[styles.headerInfo, { marginTop: headerHeight + Spacing.sm }]}>
          <LinearGradient
            colors={[theme.primary + "15", "transparent"]}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <View style={[styles.statusDot, { backgroundColor: isConnected ? "#4CAF50" : "#FF9800" }]} />
                <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
                  Chat Interna
                </ThemedText>
              </View>
              <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
                Tutti i veicoli e le sedi
              </ThemedText>
            </View>
          </LinearGradient>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messagesList,
            { paddingBottom: Spacing.md }
          ]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="message-circle" size={48} color={theme.textSecondary} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                Nessun messaggio
              </ThemedText>
              <ThemedText style={[styles.emptySubtext, { color: theme.textSecondary }]}>
                Inizia una conversazione con tutti i veicoli
              </ThemedText>
            </View>
          }
        />

        <View style={[
          styles.inputContainer,
          { 
            backgroundColor: theme.cardBackground,
            paddingBottom: tabBarHeight + Spacing.sm,
            borderTopColor: theme.border,
          }
        ]}>
          <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundDefault }]}>
            <TextInput
              style={[styles.textInput, { color: theme.text }]}
              placeholder="Scrivi un messaggio..."
              placeholderTextColor={theme.textSecondary}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
            />
            <Pressable
              style={[
                styles.sendButton,
                { 
                  backgroundColor: messageText.trim() ? theme.primary : theme.border,
                  opacity: sendMessageMutation.isPending ? 0.7 : 1,
                }
              ]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sendMessageMutation.isPending}
            >
              {sendMessageMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="send" size={18} color="#FFFFFF" />
              )}
            </Pressable>
          </View>
          
          <View style={styles.inputFooter}>
            {selectedVehicle ? (
              <View style={styles.sendingAs}>
                <AmbulanceIcon size={12} color={theme.textSecondary} />
                <ThemedText style={[styles.sendingAsText, { color: theme.textSecondary }]}>
                  Invio da {selectedVehicle.code}
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.emojiHint}>
              <ThemedText style={[styles.emojiHintText, { color: theme.textSecondary }]}>
                Usa la tastiera per gli emoji
              </ThemedText>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
      
      <Modal
        visible={selectedMessageId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedMessageId(null)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setSelectedMessageId(null)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.cardBackground }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                Letto da
              </ThemedText>
              <Pressable onPress={() => setSelectedMessageId(null)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            
            {loadingReaders ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: Spacing.lg }} />
            ) : readers.length === 0 ? (
              <View style={styles.noReadersContainer}>
                <Feather name="eye-off" size={32} color={theme.textSecondary} />
                <ThemedText style={[styles.noReadersText, { color: theme.textSecondary }]}>
                  Nessuno ha ancora letto questo messaggio
                </ThemedText>
              </View>
            ) : (
              <ScrollView style={styles.readersList}>
                {readers.map((reader, index) => (
                  <View key={index} style={[styles.readerItem, { borderBottomColor: theme.border }]}>
                    <View style={styles.readerInfo}>
                      <View style={[styles.readerAvatar, { backgroundColor: theme.primary }]}>
                        <AmbulanceIcon size={16} color="#FFFFFF" />
                      </View>
                      <ThemedText style={[styles.readerName, { color: theme.text }]}>
                        {reader.vehicleCode || "Utente"}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.readerTime, { color: theme.textSecondary }]}>
                      {new Date(reader.readAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                    </ThemedText>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    marginHorizontal: Spacing.md,
  },
  headerGradient: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerSubtitle: {
    fontSize: 12,
  },
  messagesList: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
  },
  dateHeader: {
    alignItems: "center",
    marginVertical: Spacing.md,
  },
  dateHeaderText: {
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  messageRow: {
    marginBottom: Spacing.sm,
    flexDirection: "row",
  },
  messageRowOwn: {
    justifyContent: "flex-end",
  },
  messageRowOther: {
    justifyContent: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  messageBubbleOwn: {
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    borderBottomLeftRadius: 4,
  },
  priorityMessage: {
    borderLeftWidth: 3,
    borderLeftColor: "#FF6B6B",
  },
  senderInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
  },
  senderVehicleLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  vehicleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  vehicleCode: {
    fontSize: 10,
    fontWeight: "500",
  },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  locationName: {
    fontSize: 10,
    fontWeight: "500",
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: Spacing.xs,
  },
  messageTime: {
    fontSize: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 100,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: Spacing.md,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: Spacing.xs,
    textAlign: "center",
  },
  inputContainer: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: BorderRadius.lg,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  inputFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  sendingAs: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  sendingAsText: {
    fontSize: 11,
  },
  emojiHint: {
    flexDirection: "row",
    alignItems: "center",
  },
  emojiHintText: {
    fontSize: 10,
    fontStyle: "italic",
  },
  tapToSeeReaders: {
    fontSize: 9,
    color: "rgba(255,255,255,0.5)",
    marginTop: 4,
    textAlign: "right",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 350,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    maxHeight: 400,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  noReadersContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  noReadersText: {
    fontSize: 14,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  readersList: {
    maxHeight: 280,
  },
  readerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  readerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  readerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  readerName: {
    fontSize: 14,
    fontWeight: "500",
  },
  readerTime: {
    fontSize: 12,
  },
});
