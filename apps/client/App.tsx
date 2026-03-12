import { useEffect, useState, useCallback } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { AuthScreen } from "./src/AuthScreen";
import { HomeScreen } from "./src/HomeScreen";
import { SessionScreen } from "./src/SessionScreen";
import { logout } from "./src/api";

const USER_TOKEN_KEY = "alpha_user_token";

function getLivekitUrl(): string {
  const configured = Constants.expoConfig?.extra?.livekitUrl as
    | string
    | undefined;
  if (configured) return configured;
  if (__DEV__) return "ws://localhost:7880";
  throw new Error("EXPO_PUBLIC_LIVEKIT_URL must be set for production builds");
}

const livekitUrl = getLivekitUrl();

type Screen =
  | { name: "loading" }
  | { name: "auth" }
  | { name: "home"; userToken: string }
  | { name: "session"; livekitToken: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "loading" });

  useEffect(() => {
    const token = SecureStore.getItem(USER_TOKEN_KEY);
    if (token) {
      setScreen({ name: "home", userToken: token });
    } else {
      setScreen({ name: "auth" });
    }
  }, []);

  const handleAuthenticated = useCallback((token: string) => {
    SecureStore.setItem(USER_TOKEN_KEY, token);
    setScreen({ name: "home", userToken: token });
  }, []);

  const handleLogout = useCallback(async () => {
    const token = SecureStore.getItem(USER_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_TOKEN_KEY);
    setScreen({ name: "auth" });
    // Fire-and-forget; server may already have invalidated the session
    if (token)
      logout(token).catch((err) => console.error("Logout failed:", err));
  }, []);

  const handleStartSession = useCallback((livekitToken: string) => {
    setScreen({ name: "session", livekitToken });
  }, []);

  const handleLeaveSession = useCallback(() => {
    const token = SecureStore.getItem(USER_TOKEN_KEY);
    if (token) {
      setScreen({ name: "home", userToken: token });
    } else {
      setScreen({ name: "auth" });
    }
  }, []);

  return (
    <View style={styles.container}>
      {screen.name === "loading" && (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      )}
      {screen.name === "auth" && (
        <AuthScreen onAuthenticated={handleAuthenticated} />
      )}
      {screen.name === "home" && (
        <HomeScreen
          userToken={screen.userToken}
          onStartSession={handleStartSession}
          onLogout={handleLogout}
        />
      )}
      {screen.name === "session" && (
        <SessionScreen
          livekitToken={screen.livekitToken}
          livekitUrl={livekitUrl}
          onLeave={handleLeaveSession}
        />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
