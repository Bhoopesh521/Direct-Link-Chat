import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { type ChatMessage, useP2P } from "@/context/P2PContext";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const colors = useColors();
  const isOut = msg.direction === "out";

  if (msg.type === "file") {
    return (
      <View
        style={[
          styles.bubble,
          styles.fileBubble,
          isOut
            ? [styles.bubbleOut, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "55" }]
            : [styles.bubbleIn, { backgroundColor: colors.card, borderColor: colors.border }],
        ]}
      >
        <View style={[styles.fileIconWrap, { backgroundColor: colors.primary + "30" }]}>
          <Feather name="file" size={20} color={colors.primary} />
        </View>
        <View style={styles.fileBubbleInfo}>
          <Text
            style={[styles.fileNameText, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {msg.fileName}
          </Text>
          <Text style={[styles.fileSizeText, { color: colors.mutedForeground }]}>
            {formatBytes(msg.fileSize || 0)}
          </Text>
        </View>
        <Text style={[styles.timeText, { color: colors.mutedForeground }]}>
          {formatTime(msg.timestamp)}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bubble,
        isOut
          ? [styles.bubbleOut, { backgroundColor: colors.primary }]
          : [styles.bubbleIn, { backgroundColor: colors.card, borderColor: colors.border }],
      ]}
    >
      <Text
        style={[
          styles.bubbleText,
          { color: isOut ? colors.primaryForeground : colors.foreground },
        ]}
      >
        {msg.text}
      </Text>
      <Text
        style={[
          styles.timeText,
          { color: isOut ? colors.primaryForeground + "99" : colors.mutedForeground },
        ]}
      >
        {formatTime(msg.timestamp)}
      </Text>
    </View>
  );
}

export default function ChatScreen() {
  const { peerId } = useLocalSearchParams<{ peerId: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peers, messages, sendTextMessage, sendFile, disconnectPeer } = useP2P();
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const peer = peers.find((p) => p.id === peerId);
  const chatMessages: ChatMessage[] = messages[peerId!] || [];

  const handleSend = useCallback(() => {
    if (!text.trim() || !peerId) return;
    sendTextMessage(peerId, text.trim());
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setText("");
  }, [text, peerId, sendTextMessage]);

  const handlePickFile = useCallback(async () => {
    if (!peerId) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (!file) return;

      let base64Data = "";
      if (Platform.OS !== "web" && file.uri) {
        base64Data = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else if (file.uri.startsWith("data:")) {
        base64Data = file.uri.split(",")[1] || "";
      }

      sendFile(
        peerId,
        file.name,
        file.size || 0,
        file.mimeType || "application/octet-stream",
        base64Data
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
  }, [peerId, sendFile]);

  const headerHeight = 60;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerName, { color: colors.foreground }]}>
            {peer?.label || "Unknown"}
          </Text>
          <View style={styles.headerStatus}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    peer?.status === "connected"
                      ? colors.online
                      : colors.offline,
                },
              ]}
            />
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {peer?.host}:{peer?.port}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => {
            if (peerId) disconnectPeer(peerId);
            router.back();
          }}
          style={styles.disconnectBtn}
        >
          <Feather name="wifi-off" size={18} color={colors.destructive} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={chatMessages}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={[
            styles.messageList,
            { paddingBottom: 16 },
          ]}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Feather name="message-circle" size={36} color={colors.muted} />
              <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
                No messages yet. Say hello.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        />

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: bottomPad + 8,
            },
          ]}
        >
          <TouchableOpacity
            onPress={handlePickFile}
            style={[styles.attachBtn, { backgroundColor: colors.secondary }]}
          >
            <Feather name="paperclip" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TextInput
            style={[
              styles.textInput,
              {
                color: colors.foreground,
                backgroundColor: colors.secondary,
                borderColor: colors.border,
              },
            ]}
            placeholder="Message..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={setText}
            multiline
            returnKeyType="default"
          />
          <Pressable
            onPress={handleSend}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: text.trim() ? colors.primary : colors.muted,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            disabled={!text.trim()}
          >
            <Feather
              name="send"
              size={18}
              color={text.trim() ? colors.primaryForeground : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  backBtn: { padding: 6 },
  headerCenter: { flex: 1 },
  headerName: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerStatus: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  disconnectBtn: { padding: 6 },
  messageList: { paddingHorizontal: 14, gap: 6, flexDirection: "column" },
  bubble: {
    maxWidth: "78%",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  bubbleOut: { alignSelf: "flex-end", borderRadius: 16, borderBottomRightRadius: 4 },
  bubbleIn: {
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  fileBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    borderWidth: 1,
  },
  fileIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  fileBubbleInfo: { flex: 1 },
  fileNameText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  fileSizeText: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 21 },
  timeText: { fontSize: 10, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
  emptyChat: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    gap: 10,
    transform: [{ rotate: "180deg" }],
  },
  emptyChatText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
});
