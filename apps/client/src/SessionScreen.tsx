import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AudioSession,
  LiveKitRoom,
  useVoiceAssistant,
  useConnectionState,
  useRoomContext,
  BarVisualizer,
  type AgentState,
} from "@livekit/react-native";
import { ConnectionState } from "livekit-client";
import {
  RPC_SHOW_TOPIC,
  RPC_SHOW_PODCAST,
  RPC_SHOW_PROGRESS,
  RPC_SHOW_MODE,
  RPC_SHOW_LOADING,
  RPC_SHOW_TRANSCRIPT,
  RPC_TOGGLE_PLAYBACK,
  RPC_SKIP_FORWARD,
  type SessionMode,
  type ShowTopicPayload,
  type ShowPodcastPayload,
  type ShowProgressPayload,
  type ShowModePayload,
  type ShowLoadingPayload,
  type ShowTranscriptPayload,
} from "@alpha/socket/RPCMethods";
import { useMediaSession } from "./useMediaSession";
import { HelpOverlay } from "./HelpOverlay";

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

// --- State management ---

type ContentCard =
  | { type: "topic"; title: string; summary: string; imageUrl?: string }
  | { type: "podcast"; title: string; show: string; duration: number };

interface SessionState {
  mode: SessionMode;
  currentCard: ContentCard | null;
  history: ContentCard[];
  transcript: string | null;
  showTranscript: boolean;
  loading: string | null;
  progress: { items: number; current: number } | null;
}

type SessionAction =
  | { type: "SHOW_TOPIC"; payload: ShowTopicPayload }
  | { type: "SHOW_PODCAST"; payload: ShowPodcastPayload }
  | { type: "SHOW_PROGRESS"; payload: ShowProgressPayload }
  | { type: "SHOW_MODE"; payload: ShowModePayload }
  | { type: "SHOW_LOADING"; payload: ShowLoadingPayload }
  | { type: "SHOW_TRANSCRIPT"; payload: ShowTranscriptPayload }
  | { type: "TOGGLE_TRANSCRIPT" };

const initialState: SessionState = {
  mode: "catchup",
  currentCard: null,
  history: [],
  transcript: null,
  showTranscript: false,
  loading: null,
  progress: null,
};

const MAX_HISTORY = 50;

function pushCard(state: SessionState, card: ContentCard): SessionState {
  const history = state.currentCard
    ? [...state.history, state.currentCard].slice(-MAX_HISTORY)
    : state.history;
  return { ...state, currentCard: card, loading: null, history };
}

function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case "SHOW_TOPIC":
      return pushCard(state, {
        type: "topic",
        title: action.payload.title,
        summary: action.payload.summary,
        imageUrl: action.payload.imageUrl,
      });
    case "SHOW_PODCAST":
      return pushCard(state, {
        type: "podcast",
        title: action.payload.title,
        show: action.payload.show,
        duration: action.payload.duration,
      });
    case "SHOW_PROGRESS": {
      const { items, current } = action.payload;
      if (
        state.progress?.items === items &&
        state.progress.current === current
      ) {
        return state;
      }
      return { ...state, progress: { items, current } };
    }
    case "SHOW_MODE":
      return { ...state, mode: action.payload.mode, progress: null };
    case "SHOW_LOADING":
      return { ...state, loading: action.payload.message ?? "Loading..." };
    case "SHOW_TRANSCRIPT":
      return { ...state, transcript: action.payload.text };
    case "TOGGLE_TRANSCRIPT":
      return { ...state, showTranscript: !state.showTranscript };
  }
}

// --- Status labels ---

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

const MODE_LABELS: Record<SessionMode, string> = {
  setup: "Setup",
  catchup: "Catch-Up",
  browse: "Browse",
  playback: "Playback",
};

const MODE_COLORS: Record<SessionMode, string> = {
  setup: "#5856D6",
  catchup: "#FF9500",
  browse: "#34C759",
  playback: "#007AFF",
};

// --- Components ---

function SessionContent({ onLeave }: { onLeave: () => void }) {
  const { state: agentState, audioTrack, agent } = useVoiceAssistant();
  const connectionState = useConnectionState();
  const room = useRoomContext();
  const [sessionState, dispatch] = useReducer(sessionReducer, initialState);
  const [helpVisible, setHelpVisible] = useState(false);
  const historyRef = useRef<ScrollView>(null);
  const rpcRegistered = useRef(false);

  // Send RPCs to the agent for lock screen remote controls
  const sendAgentRpc = useCallback(
    (method: typeof RPC_TOGGLE_PLAYBACK | typeof RPC_SKIP_FORWARD) => {
      const identity = agent?.identity;
      if (!identity) return;
      room.localParticipant
        .performRpc({
          destinationIdentity: identity,
          method,
          payload: "",
        })
        .catch((err: unknown) => console.error(`RPC ${method} failed:`, err));
    },
    [room, agent],
  );

  const { updateNowPlaying } = useMediaSession({
    onTogglePlayback: () => sendAgentRpc(RPC_TOGGLE_PLAYBACK),
    onSkipForward: () => sendAgentRpc(RPC_SKIP_FORWARD),
  });

  // Register RPC handlers
  useEffect(() => {
    if (connectionState !== ConnectionState.Connected || rpcRegistered.current)
      return;

    const handlers: [string, (payload: string) => void][] = [
      [
        RPC_SHOW_TOPIC,
        (p) => {
          const payload = JSON.parse(p) as ShowTopicPayload;
          dispatch({ type: "SHOW_TOPIC", payload });
          updateNowPlaying(payload.title, "Alpha");
        },
      ],
      [
        RPC_SHOW_PODCAST,
        (p) => {
          const payload = JSON.parse(p) as ShowPodcastPayload;
          dispatch({ type: "SHOW_PODCAST", payload });
          updateNowPlaying(payload.title, payload.show);
        },
      ],
      [
        RPC_SHOW_PROGRESS,
        (p) =>
          dispatch({
            type: "SHOW_PROGRESS",
            payload: JSON.parse(p) as ShowProgressPayload,
          }),
      ],
      [
        RPC_SHOW_MODE,
        (p) => {
          const payload = JSON.parse(p) as ShowModePayload;
          dispatch({ type: "SHOW_MODE", payload });
          updateNowPlaying("Alpha", "Alpha - " + MODE_LABELS[payload.mode]);
        },
      ],
      [
        RPC_SHOW_LOADING,
        (p) =>
          dispatch({
            type: "SHOW_LOADING",
            payload: JSON.parse(p) as ShowLoadingPayload,
          }),
      ],
      [
        RPC_SHOW_TRANSCRIPT,
        (p) =>
          dispatch({
            type: "SHOW_TRANSCRIPT",
            payload: JSON.parse(p) as ShowTranscriptPayload,
          }),
      ],
    ];

    for (const [method, handler] of handlers) {
      room.registerRpcMethod(method, async (data) => {
        try {
          handler(data.payload);
        } catch (err) {
          console.warn(`Failed to handle RPC ${method}:`, err);
        }
        return "";
      });
    }

    rpcRegistered.current = true;

    return () => {
      for (const [method] of handlers) {
        room.unregisterRpcMethod(method);
      }
      rpcRegistered.current = false;
    };
  }, [room, connectionState, updateNowPlaying]);

  const statusText =
    connectionState !== ConnectionState.Connected
      ? "Connecting..."
      : (STATUS_LABELS[agentState] ?? agentState);

  return (
    <View style={styles.container}>
      {/* Mode badge */}
      <View
        style={[
          styles.modeBadge,
          { backgroundColor: MODE_COLORS[sessionState.mode] },
        ]}
      >
        <Text style={styles.modeBadgeText}>
          {MODE_LABELS[sessionState.mode]}
        </Text>
      </View>

      {/* Status + Visualizer */}
      <Text style={styles.status}>{statusText}</Text>
      <BarVisualizer
        state={agentState}
        trackRef={audioTrack}
        barCount={5}
        style={styles.visualizer}
      />

      {/* Loading indicator */}
      {sessionState.loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{sessionState.loading}</Text>
        </View>
      )}

      {/* Progress indicator */}
      {sessionState.progress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    sessionState.progress.items > 0
                      ? `${(sessionState.progress.current / sessionState.progress.items) * 100}%`
                      : "0%",
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {sessionState.progress.current} / {sessionState.progress.items}
          </Text>
        </View>
      )}

      {/* Current content card */}
      {sessionState.currentCard && (
        <CurrentCard card={sessionState.currentCard} />
      )}

      {/* Session history */}
      {sessionState.history.length > 0 && (
        <ScrollView
          ref={historyRef}
          style={styles.historyContainer}
          onContentSizeChange={() =>
            historyRef.current?.scrollToEnd({ animated: true })
          }
        >
          {sessionState.history.map((card, i) => (
            <HistoryCard key={i} card={card} />
          ))}
        </ScrollView>
      )}

      {/* Transcript */}
      {sessionState.showTranscript && sessionState.transcript && (
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcriptText}>{sessionState.transcript}</Text>
        </View>
      )}

      {/* Bottom controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.transcriptToggle}
          onPress={() => dispatch({ type: "TOGGLE_TRANSCRIPT" })}
        >
          <Text
            style={[
              styles.transcriptToggleText,
              sessionState.showTranscript && styles.transcriptToggleActive,
            ]}
          >
            Transcript
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.stopButton} onPress={onLeave}>
          <Text style={styles.stopButtonText}>Stop</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.helpToggle}
          onPress={() => setHelpVisible(true)}
        >
          <Text style={styles.helpToggleText}>?</Text>
        </TouchableOpacity>
      </View>

      <HelpOverlay
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
      />
    </View>
  );
}

function CurrentCard({ card }: { card: ContentCard }) {
  if (card.type === "topic") {
    return (
      <View style={styles.currentCard}>
        <Text style={styles.cardTitle}>{card.title}</Text>
        <Text style={styles.cardSummary} numberOfLines={3}>
          {card.summary}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.currentCard}>
      <Text style={styles.cardLabel}>Podcast</Text>
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.cardMeta}>{card.show}</Text>
      {card.duration > 0 && (
        <Text style={styles.cardMeta}>
          {Math.floor(card.duration / 60)} min
        </Text>
      )}
    </View>
  );
}

function HistoryCard({ card }: { card: ContentCard }) {
  return (
    <View style={styles.historyCard}>
      <Text style={styles.historyCardTitle}>{card.title}</Text>
      {card.type === "topic" && (
        <Text style={styles.historyCardSummary} numberOfLines={1}>
          {card.summary}
        </Text>
      )}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 24,
    paddingTop: 60,
  },
  modeBadge: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  modeBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  status: {
    color: "#fff",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  visualizer: {
    width: 200,
    height: 120,
    alignSelf: "center",
    marginBottom: 24,
  },
  loadingContainer: {
    alignSelf: "center",
    marginBottom: 12,
  },
  loadingText: {
    color: "#8E8E93",
    fontSize: 14,
    fontStyle: "italic",
  },
  progressContainer: {
    alignSelf: "stretch",
    marginBottom: 16,
    alignItems: "center",
  },
  progressBar: {
    width: "100%",
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FF9500",
    borderRadius: 2,
  },
  progressText: {
    color: "#8E8E93",
    fontSize: 12,
  },
  currentCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  cardSummary: {
    color: "#AEAEB2",
    fontSize: 14,
    lineHeight: 20,
  },
  cardMeta: {
    color: "#8E8E93",
    fontSize: 13,
  },
  historyContainer: {
    flex: 1,
    marginBottom: 12,
  },
  historyCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: 8,
    padding: 12,
    marginBottom: 6,
    opacity: 0.7,
  },
  historyCardTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  historyCardSummary: {
    color: "#8E8E93",
    fontSize: 12,
    marginTop: 2,
  },
  transcriptContainer: {
    backgroundColor: "#1C1C1E",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    maxHeight: 80,
  },
  transcriptText: {
    color: "#AEAEB2",
    fontSize: 13,
    lineHeight: 18,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  transcriptToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  transcriptToggleText: {
    color: "#8E8E93",
    fontSize: 14,
  },
  transcriptToggleActive: {
    color: "#007AFF",
  },
  stopButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF3B30",
    justifyContent: "center",
    alignItems: "center",
  },
  stopButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  helpToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  helpToggleText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
});
