import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useP2P } from "@/context/P2PContext";

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text style={[styles.infoValue, { color: colors.foreground }]}>
        {value}
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { myPort, setMyPort, serverRunning } = useP2P();
  const [portInput, setPortInput] = useState(myPort.toString());

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSavePort = () => {
    const n = parseInt(portInput, 10);
    if (isNaN(n) || n < 1024 || n > 65535) {
      Alert.alert("Invalid Port", "Port must be between 1024 and 65535.");
      return;
    }
    setMyPort(n);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: bottomPad + 90 }}
    >
      <View
        style={[styles.header, { paddingTop: topPad + 12 }]}
      >
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Settings
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          MY NODE
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.statusRow]}>
            <View
              style={[
                styles.statusIndicator,
                {
                  backgroundColor: serverRunning ? colors.online : colors.offline,
                },
              ]}
            />
            <Text style={[styles.statusText, { color: colors.foreground }]}>
              {serverRunning ? "Listening" : "Stopped"}
            </Text>
          </View>
          <View style={[styles.portRow, { borderTopColor: colors.border }]}>
            <View style={styles.portLabelWrap}>
              <Feather name="anchor" size={14} color={colors.mutedForeground} />
              <Text style={[styles.portLabel, { color: colors.mutedForeground }]}>
                Listen Port
              </Text>
            </View>
            <View style={styles.portInputWrap}>
              <TextInput
                style={[
                  styles.portInput,
                  {
                    color: colors.foreground,
                    backgroundColor: colors.input,
                    borderColor: colors.border,
                  },
                ]}
                value={portInput}
                onChangeText={setPortInput}
                keyboardType="numeric"
                returnKeyType="done"
                onSubmitEditing={handleSavePort}
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                onPress={handleSavePort}
              >
                <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>
                  Apply
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          HOW IT WORKS
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {[
            {
              icon: "zap" as const,
              title: "Truly P2P",
              desc: "No servers, no cloud. Every byte goes directly from device to device over raw TCP.",
            },
            {
              icon: "shield" as const,
              title: "Manual Discovery",
              desc: "Add peers by entering their IP address (IPv4 or IPv6) and port number.",
            },
            {
              icon: "message-circle" as const,
              title: "Real-time Chat",
              desc: "Text messages are sent instantly over the TCP connection.",
            },
            {
              icon: "upload" as const,
              title: "Direct File Transfer",
              desc: "Files are chunked and streamed directly — no intermediary storage.",
            },
          ].map((item, i, arr) => (
            <View
              key={item.title}
              style={[
                styles.howRow,
                i < arr.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.howIcon,
                  { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Feather name={item.icon} size={16} color={colors.primary} />
              </View>
              <View style={styles.howText}>
                <Text style={[styles.howTitle, { color: colors.foreground }]}>
                  {item.title}
                </Text>
                <Text style={[styles.howDesc, { color: colors.mutedForeground }]}>
                  {item.desc}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>
          ANDROID SETUP
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.helpText, { color: colors.mutedForeground }]}>
            Android may block incoming TCP connections by default. To allow peers to connect to you, run the following ADB command on your device:
          </Text>
          <View
            style={[
              styles.codeBlock,
              { backgroundColor: colors.background, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.code, { color: colors.primary }]}>
              {`adb shell iptables -I INPUT -p tcp --dport ${myPort} -j ACCEPT`}
            </Text>
          </View>
          <Text style={[styles.helpText, { color: colors.mutedForeground }]}>
            Replace the port if you changed the listen port above.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  statusIndicator: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  portRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  portLabelWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  portLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  portInputWrap: { flexDirection: "row", gap: 10 },
  portInput: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  infoValue: { fontSize: 14, fontFamily: "Inter_500Medium" },
  howRow: {
    flexDirection: "row",
    gap: 14,
    padding: 16,
    alignItems: "flex-start",
  },
  howIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  howText: { flex: 1, gap: 3 },
  howTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  howDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  helpText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, padding: 16 },
  codeBlock: {
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  code: { fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
});
