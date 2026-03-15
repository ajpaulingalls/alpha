import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface HelpOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export function HelpOverlay({ visible, onClose }: HelpOverlayProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent={false}>
      <View style={styles.container}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>X</Text>
        </TouchableOpacity>

        <ScrollView style={styles.scrollView}>
          <Text style={styles.title}>How to Use Alpha</Text>

          <Text style={styles.sectionTitle}>Catch-Up</Text>
          <Text style={styles.body}>
            Alpha delivers a personalized news briefing when you start a
            session. Try saying:
          </Text>
          <Text style={styles.command}>
            {'"Tell me about the latest tech news"'}
          </Text>
          <Text style={styles.command}>{'"What happened today?"'}</Text>
          <Text style={styles.command}>{'"Skip this story"'}</Text>

          <Text style={styles.sectionTitle}>Browse</Text>
          <Text style={styles.body}>
            Search and explore podcasts by topic or keyword. Try saying:
          </Text>
          <Text style={styles.command}>{'"Find podcasts about AI"'}</Text>
          <Text style={styles.command}>{'"Search for climate change"'}</Text>
          <Text style={styles.command}>{'"What else do you have?"'}</Text>

          <Text style={styles.sectionTitle}>Playback</Text>
          <Text style={styles.body}>
            Control podcast playback with your voice. Try saying:
          </Text>
          <Text style={styles.command}>{'"Play this episode"'}</Text>
          <Text style={styles.command}>{'"Skip forward"'}</Text>
          <Text style={styles.command}>
            {'"Pause"'} / {'"Resume"'}
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  closeButton: {
    position: "absolute",
    top: 56,
    right: 24,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  closeText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
    marginTop: 16,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 32,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
    marginTop: 24,
    marginBottom: 8,
  },
  body: {
    color: "#AEAEB2",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  command: {
    color: "#007AFF",
    fontSize: 15,
    marginLeft: 16,
    marginBottom: 6,
  },
});
