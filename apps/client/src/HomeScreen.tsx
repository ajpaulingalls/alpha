import { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { fetchLiveKitToken, UnauthorizedError, alertError } from "./api";

interface HomeScreenProps {
  userToken: string;
  onStartSession: (livekitToken: string) => void;
  onLogout: () => void;
}

export function HomeScreen({
  userToken,
  onStartSession,
  onLogout,
}: HomeScreenProps) {
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      const { token } = await fetchLiveKitToken(userToken);
      onStartSession(token);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        onLogout();
        return;
      }
      alertError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alpha</Text>
      <Text style={styles.subtitle}>Your AI podcast companion</Text>
      <TouchableOpacity
        style={[styles.startButton, loading && styles.buttonDisabled]}
        onPress={handleStart}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="large" />
        ) : (
          <Text style={styles.startButtonText}>Start</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 48,
  },
  startButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  startButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  logoutButton: {
    padding: 10,
  },
  logoutText: {
    color: "#999",
    fontSize: 14,
  },
});
