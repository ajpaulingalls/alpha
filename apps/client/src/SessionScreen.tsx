import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  AudioSession,
  LiveKitRoom,
  useVoiceAssistant,
  useConnectionState,
  BarVisualizer,
  type AgentState,
} from "@livekit/react-native";
import { ConnectionState } from "livekit-client";

interface SessionScreenProps {
  livekitToken: string;
  livekitUrl: string;
  onLeave: () => void;
}

export function SessionScreen({
  livekitToken,
  livekitUrl,
  onLeave,
}: SessionScreenProps) {
  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={livekitToken}
      connect={true}
      audio={true}
      video={false}
    >
      <SessionContent onLeave={onLeave} />
    </LiveKitRoom>
  );
}

const STATUS_LABELS: Partial<Record<AgentState, string>> = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  "pre-connect-buffering": "Connecting...",
  initializing: "Initializing...",
  listening: "Listening",
  thinking: "Thinking...",
  speaking: "Speaking",
  failed: "Connection failed",
};

function SessionContent({ onLeave }: { onLeave: () => void }) {
  const { state, audioTrack } = useVoiceAssistant();
  const connectionState = useConnectionState();

  const statusText =
    connectionState !== ConnectionState.Connected
      ? "Connecting..."
      : (STATUS_LABELS[state] ?? state);

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{statusText}</Text>
      <BarVisualizer
        state={state}
        trackRef={audioTrack}
        barCount={5}
        style={styles.visualizer}
      />
      <TouchableOpacity style={styles.stopButton} onPress={onLeave}>
        <Text style={styles.stopButtonText}>Stop</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
    padding: 32,
  },
  status: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 32,
  },
  visualizer: {
    width: 200,
    height: 200,
    marginBottom: 48,
  },
  stopButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
  stopButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
