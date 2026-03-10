import { StatusBar } from "expo-status-bar";
import { useRef, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAsyncStorage } from "@react-native-async-storage/async-storage";
import {
  AudioEncoding,
  RealtimeAudioModule,
  RealtimeAudioPlayerView,
  RealtimeAudioPlayerViewRef,
  RealtimeAudioRecorderView,
  RealtimeAudioRecorderViewRef,
  Visualizers,
} from "react-native-realtime-audio";
import { io, Socket } from "socket.io-client";
import type { RealtimeItem } from "openai-realtime-socket-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  DeltaType,
} from "@alpha/socket/SocketInterfaces";

const USER_TOKEN_KEY = "@alpha_user_token";

export default function App() {
  const playerRef = useRef<RealtimeAudioPlayerViewRef>(null);
  const recorderRef = useRef<RealtimeAudioRecorderViewRef>(null);
  const { getItem, setItem } = useAsyncStorage(USER_TOKEN_KEY);
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [connectionStatus, setConnectionStatus] = useState("Disconnected");
  const [currentItemId, setCurrentItemId] = useState<string>("");
  const [userToken, setUserToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);

  useEffect(() => {
    const loadUserToken = async () => {
      try {
        const token = await getItem();
        setUserToken(token);
      } catch (error) {
        console.error("Error loading user token:", error);
      } finally {
        setTokenLoaded(true);
      }
    };
    loadUserToken();
  }, []);

  useEffect(() => {
    const checkPermissions = async () => {
      const result =
        await RealtimeAudioModule.checkAndRequestAudioPermissions();
      console.log("Permission result", result);
      if (!result) {
        console.log("Permission not granted");
      }
    };
    checkPermissions();
  }, []);

  useEffect(() => {
    // Don't connect until token is loaded
    if (!tokenLoaded) {
      return;
    }

    // Initialize socket connection with token via auth (not query params)
    const socketUrl = "http://192.168.7.141:8082";

    const newSocket = io(socketUrl, {
      auth: userToken ? { token: userToken } : undefined,
    }) as Socket<ServerToClientEvents, ClientToServerEvents>;

    // Socket event handlers
    newSocket.on("connect", () => {
      setConnectionStatus("Connected");
      console.log("Socket connected");
    });

    newSocket.on("disconnect", () => {
      setConnectionStatus("Disconnected");
      console.log("Socket disconnected");
    });

    newSocket.on("error", (error) => {
      setConnectionStatus("Error");
      console.log("Socket error", error);
    });

    newSocket.on("ready", () => {
      recorderRef.current?.startRecording();
    });

    newSocket.on("saveUserToken", async (token: string) => {
      console.log("Saving user token");
      try {
        await setItem(token);
        setUserToken(token);
      } catch (error) {
        console.error("Error saving user token:", error);
      }
    });

    newSocket.on(
      "conversationUpdated",
      (item: RealtimeItem, delta: DeltaType) => {
        setCurrentItemId(item.id);
        if (delta.audio) {
          playerRef.current?.addBuffer(delta.audio);
        }
      }
    );

    // Store socket instance
    setSocket(newSocket);

    // Cleanup on component unmount
    return () => {
      newSocket.close();
    };
  }, [userToken, tokenLoaded]);

  return (
    <View style={styles.container}>
      <Text style={styles.status}>Socket Status: {connectionStatus}</Text>
      <RealtimeAudioPlayerView
        ref={playerRef}
        audioFormat={{
          sampleRate: 24000,
          encoding: AudioEncoding.pcm16bitInteger,
          channelCount: 1,
        }}
        visualizer={Visualizers.tripleCircle}
        onPlaybackStarted={() => {
          console.log("Playback started");
        }}
        onPlaybackStopped={() => {
          console.log("Playback stopped");
          if (currentItemId) {
            socket?.emit("audioPlaybackComplete", currentItemId);
          }
        }}
        style={{
          width: 200,
          height: 200,
        }}
      />
      <RealtimeAudioRecorderView
        ref={recorderRef}
        audioFormat={{
          sampleRate: 24000,
          encoding: AudioEncoding.pcm16bitInteger,
          channelCount: 1,
        }}
        onAudioCaptured={(audio) => {
          socket?.emit("appendAudio", audio.nativeEvent.audioBuffer);
        }}
        echoCancellationEnabled={true}
        style={{
          width: 200,
          height: 100,
        }}
      />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  status: {
    marginBottom: 20,
    fontSize: 16,
  },
});
