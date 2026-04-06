import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { type Peer, useP2P } from "@/context/P2PContext";

function StatusDot({ status }: { status: Peer["status"] }) {
  const colors = useColors();
  const colorMap: Record<Peer["status"], string> = {
    connected: colors.online,
    connecting: colors.connecting,
    offline: colors.offline,
    error: colors.destructive,
  };
  return (
    <View
      style={[styles.statusDot, { backgroundColor: colorMap[status] }]}
    />
  );
}

function PeerCard({
  peer,
  onPress,
  onConnect,
  onDisconnect,
  onRemove,
}: {
  peer: Peer;
  onPress: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
}) {
  const colors = useColors();
  const isConnected = peer.status === "connected";
  const isConnecting = peer.status === "connecting";

  return (
    <Pressable
      style={({ pressed }) => [
        styles.peerCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.peerCardLeft}>
        <StatusDot status={peer.status} />
        <View style={styles.peerInfo}>
          <Text style={[styles.peerLabel, { color: colors.foreground }]}>
            {peer.label}
          </Text>
          <Text style={[styles.peerAddress, { color: colors.mutedForeground }]}>
            {peer.host}:{peer.port}
          </Text>
        </View>
      </View>
      <View style={styles.peerActions}>
        {isConnected ? (
          <TouchableOpacity
            onPress={onDisconnect}
            style={[styles.actionBtn, { borderColor: colors.border }]}
          >
            <Feather name="wifi-off" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onConnect}
            style={[
              styles.actionBtn,
              {
                borderColor: colors.primary,
                backgroundColor: isConnecting ? "transparent" : colors.primary + "18",
              },
            ]}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <Feather name="loader" size={14} color={colors.primary} />
            ) : (
              <Feather name="wifi" size={14} color={colors.primary} />
            )}
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={onRemove}
          style={[styles.actionBtn, { borderColor: colors.border }]}
        >
          <Feather name="trash-2" size={14} color={colors.destructive} />
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

export default function PeersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { peers, addPeer, removePeer, connectToPeer, disconnectPeer, serverRunning, myPort } =
    useP2P();
  const [showAddModal, setShowAddModal] = useState(false);
  const [label, setLabel] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("9876");

  const handleAdd = () => {
    if (!host.trim() || !port.trim()) return;
    addPeer(label.trim() || host.trim(), host.trim(), parseInt(port, 10));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLabel("");
    setHost("");
    setPort("9876");
    setShowAddModal(false);
  };

  const handleConnect = (peer: Peer) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    connectToPeer(peer.id);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Peers
          </Text>
          <View style={styles.serverStatus}>
            <View
              style={[
                styles.serverDot,
                { backgroundColor: serverRunning ? colors.online : colors.offline },
              ]}
            />
            <Text style={[styles.serverLabel, { color: colors.mutedForeground }]}>
              {serverRunning ? `Listening on :${myPort}` : "Server stopped"}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() => setShowAddModal(true)}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
        >
          <Feather name="plus" size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={peers}
        keyExtractor={(p) => p.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomPad + 90 },
        ]}
        renderItem={({ item }) => (
          <PeerCard
            peer={item}
            onPress={() => {
              if (item.status === "connected") {
                router.push(`/chat/${item.id}`);
              }
            }}
            onConnect={() => handleConnect(item)}
            onDisconnect={() => disconnectPeer(item.id)}
            onRemove={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              removePeer(item.id);
            }}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="wifi-off" size={40} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              No peers yet
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Add a peer by entering their IP address and port
            </Text>
          </View>
        }
      />

      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowAddModal(false)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => {}}
          >
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              Add Peer
            </Text>
            <TextInput
              style={[
                styles.input,
                { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border },
              ]}
              placeholder="Label (optional)"
              placeholderTextColor={colors.mutedForeground}
              value={label}
              onChangeText={setLabel}
            />
            <TextInput
              style={[
                styles.input,
                { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border },
              ]}
              placeholder="IP Address (IPv4 or IPv6)"
              placeholderTextColor={colors.mutedForeground}
              value={host}
              onChangeText={setHost}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
            />
            <TextInput
              style={[
                styles.input,
                { color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border },
              ]}
              placeholder="Port"
              placeholderTextColor={colors.mutedForeground}
              value={port}
              onChangeText={setPort}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: colors.primary }]}
              onPress={handleAdd}
            >
              <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>
                Add Peer
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  serverStatus: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 },
  serverDot: { width: 6, height: 6, borderRadius: 3 },
  serverLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingTop: 12, paddingHorizontal: 16, gap: 10 },
  peerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  peerCardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  peerInfo: { flex: 1 },
  peerLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  peerAddress: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  peerActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "#000000aa",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#555",
    alignSelf: "center",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  submitBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
