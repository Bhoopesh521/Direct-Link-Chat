import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useP2P, type FileTransfer } from "@/context/P2PContext";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function FileItem({ transfer }: { transfer: FileTransfer }) {
  const colors = useColors();
  const isOut = transfer.direction === "out";
  const isDone = transfer.status === "done";
  const progress = Math.round(transfer.progress * 100);

  const iconName =
    transfer.fileType?.startsWith("image/")
      ? "image"
      : transfer.fileType?.startsWith("video/")
      ? "video"
      : transfer.fileType?.startsWith("audio/")
      ? "music"
      : "file";

  return (
    <View
      style={[
        styles.fileCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.fileIconWrap,
          { backgroundColor: colors.primary + "20" },
        ]}
      >
        <Feather name={iconName as any} size={20} color={colors.primary} />
      </View>
      <View style={styles.fileInfo}>
        <Text
          style={[styles.fileName, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {transfer.fileName}
        </Text>
        <Text
          style={[styles.fileMeta, { color: colors.mutedForeground }]}
        >
          {formatBytes(transfer.fileSize)} · {isOut ? "Sent" : "Received"}
        </Text>
        {!isDone && (
          <View style={[styles.progressTrack, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.primary,
                  width: `${progress}%` as any,
                },
              ]}
            />
          </View>
        )}
        {!isDone && (
          <Text style={[styles.progressText, { color: colors.mutedForeground }]}>
            {progress}%
          </Text>
        )}
      </View>
      <View style={styles.fileStatus}>
        {isDone ? (
          <Feather name="check-circle" size={18} color={colors.online} />
        ) : (
          <Feather name="loader" size={18} color={colors.connecting} />
        )}
        {isOut ? (
          <Feather name="arrow-up" size={12} color={colors.mutedForeground} />
        ) : (
          <Feather name="arrow-down" size={12} color={colors.mutedForeground} />
        )}
      </View>
    </View>
  );
}

export default function FilesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { transfers, peers, sendFile } = useP2P();
  const [selectedPeerId, setSelectedPeerId] = useState<string>("");

  const connectedPeers = peers.filter((p) => p.status === "connected");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handlePickFile = async () => {
    if (!selectedPeerId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
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
        selectedPeerId,
        file.name,
        file.size || 0,
        file.mimeType || "application/octet-stream",
        base64Data
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Files
        </Text>
      </View>

      {connectedPeers.length > 0 && (
        <View style={[styles.sendPanel, { borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            SEND TO
          </Text>
          <View style={styles.peerChips}>
            {connectedPeers.map((peer) => (
              <TouchableOpacity
                key={peer.id}
                onPress={() => setSelectedPeerId(peer.id)}
                style={[
                  styles.chip,
                  {
                    backgroundColor:
                      selectedPeerId === peer.id
                        ? colors.primary
                        : colors.secondary,
                    borderColor:
                      selectedPeerId === peer.id
                        ? colors.primary
                        : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    {
                      color:
                        selectedPeerId === peer.id
                          ? colors.primaryForeground
                          : colors.foreground,
                    },
                  ]}
                >
                  {peer.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[
              styles.sendBtn,
              {
                backgroundColor: selectedPeerId ? colors.primary : colors.muted,
              },
            ]}
            onPress={handlePickFile}
            disabled={!selectedPeerId}
          >
            <Feather
              name="upload"
              size={16}
              color={selectedPeerId ? colors.primaryForeground : colors.mutedForeground}
            />
            <Text
              style={[
                styles.sendBtnText,
                {
                  color: selectedPeerId
                    ? colors.primaryForeground
                    : colors.mutedForeground,
                },
              ]}
            >
              Pick & Send File
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={[...transfers].reverse()}
        keyExtractor={(t) => t.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad + 90 },
        ]}
        renderItem={({ item }) => <FileItem transfer={item} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="folder" size={40} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No transfers yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {connectedPeers.length === 0
                ? "Connect to a peer first, then send files directly"
                : "Select a peer and pick a file to send"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  sendPanel: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
  },
  peerChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  sendBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  list: { paddingTop: 12, paddingHorizontal: 16, gap: 10 },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fileInfo: { flex: 1, gap: 2 },
  fileName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  fileMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 6,
  },
  progressFill: { height: "100%", borderRadius: 2 },
  progressText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  fileStatus: { alignItems: "center", gap: 4 },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 10,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginTop: 12 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
