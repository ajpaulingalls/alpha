import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import {
  fetchLiveKitToken,
  fetchPreferences,
  updatePreferences,
  UnauthorizedError,
  alertError,
  type CatchUpDepth,
} from "./api";
import { HelpOverlay } from "./HelpOverlay";

interface UserInfo {
  name: string;
  email: string;
  catchUpDepth: CatchUpDepth;
}

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
  const [helpVisible, setHelpVisible] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetchPreferences(userToken)
      .then((data) => {
        setUserInfo({
          name: data.user.name,
          email: data.user.email,
          catchUpDepth: data.preferences.catchUpDepth,
        });

        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (data.preferences.timezone !== timezone) {
          updatePreferences(userToken, { timezone }).catch((err) =>
            console.error("Failed to update timezone:", err),
          );
        }
      })
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          onLogout();
          return;
        }
        console.error("Failed to fetch preferences:", err);
      });
  }, [userToken, onLogout]);

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

  const handleDepthChange = (depth: CatchUpDepth) => {
    setUserInfo((prev) => (prev ? { ...prev, catchUpDepth: depth } : prev));
    updatePreferences(userToken, { catchUpDepth: depth }).catch((err) =>
      console.error("Failed to update catch-up depth:", err),
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.helpButton}
        onPress={() => setHelpVisible(true)}
      >
        <Text style={styles.helpButtonText}>?</Text>
      </TouchableOpacity>

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

      {/* Preferences */}
      {userInfo && (
        <View style={styles.prefsSection}>
          {userInfo.name ? (
            <Text style={styles.prefsName}>{userInfo.name}</Text>
          ) : null}
          {userInfo.email ? (
            <Text style={styles.prefsEmail}>{userInfo.email}</Text>
          ) : null}

          <Text style={styles.prefsLabel}>Catch-Up Depth</Text>
          <View style={styles.pillRow}>
            {(["brief", "standard", "detailed"] as const).map((depth) => (
              <TouchableOpacity
                key={depth}
                style={[
                  styles.pill,
                  userInfo.catchUpDepth === depth && styles.pillActive,
                ]}
                onPress={() => handleDepthChange(depth)}
              >
                <Text
                  style={[
                    styles.pillText,
                    userInfo.catchUpDepth === depth && styles.pillTextActive,
                  ]}
                >
                  {depth.charAt(0).toUpperCase() + depth.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <HelpOverlay
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
      />
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
  helpButton: {
    position: "absolute",
    top: 56,
    right: 24,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    alignItems: "center",
  },
  helpButtonText: {
    color: "#333",
    fontSize: 16,
    fontWeight: "bold",
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
  prefsSection: {
    marginTop: 32,
    alignItems: "center",
  },
  prefsName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  prefsEmail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  prefsLabel: {
    fontSize: 12,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#E5E5EA",
  },
  pillActive: {
    backgroundColor: "#007AFF",
  },
  pillText: {
    fontSize: 14,
    color: "#333",
  },
  pillTextActive: {
    color: "#fff",
  },
});
