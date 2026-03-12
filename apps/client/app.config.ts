import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "alpha",
  slug: "alpha",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.anonymous.alpha",
    infoPlist: {
      NSMicrophoneUsageDescription:
        "Alpha needs microphone access for voice conversations",
      UIBackgroundModes: ["audio"],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.anonymous.alpha",
    permissions: ["RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "@livekit/react-native-expo-plugin",
    "@config-plugins/react-native-webrtc",
  ],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8081",
    livekitUrl: process.env.EXPO_PUBLIC_LIVEKIT_URL ?? "ws://localhost:7880",
  },
};

export default config;
