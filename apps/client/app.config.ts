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
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
    package: "com.anonymous.alpha",
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: ["react-native-realtime-audio"],
  extra: {
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL ?? "http://localhost:8082",
  },
};

export default config;
