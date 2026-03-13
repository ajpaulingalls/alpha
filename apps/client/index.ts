import { registerGlobals } from "@livekit/react-native";
import { registerRootComponent } from "expo";
import TrackPlayer from "react-native-track-player";

import App from "./App";

registerGlobals();

// Register a no-op playback service — RNTP requires this for Android.
// We only use RNTP for media session metadata and remote control events;
// actual audio is handled by LiveKit WebRTC.
// eslint-disable-next-line @typescript-eslint/no-empty-function
TrackPlayer.registerPlaybackService(() => async () => {});

registerRootComponent(App);
