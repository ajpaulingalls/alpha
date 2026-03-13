import { useEffect, useRef, useCallback } from "react";
import TrackPlayer, {
  Event,
  RepeatMode,
  Capability,
  IOSCategory,
  IOSCategoryMode,
  IOSCategoryOptions,
} from "react-native-track-player";

// React Native's require() returns a number (opaque asset reference) at runtime,
// but RNTP's AddTrack.url accepts string | ResourceObject (= number).
// The base Track type narrows url to string, so we cast through unknown.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const silenceAsset = require("../assets/silence.mp3") as unknown as string;

export interface UseMediaSessionOptions {
  onTogglePlayback: () => void;
  onSkipForward: () => void;
}

export interface UseMediaSessionReturn {
  updateNowPlaying: (title: string, artist: string) => void;
}

/**
 * Activates the platform media session by playing a silent track via
 * react-native-track-player. Exposes lock-screen remote control events
 * (play/pause, skip) via callbacks, and lets callers set Now Playing metadata.
 *
 * The actual audio is handled by LiveKit's WebRTC transport — this hook only
 * manages the media session layer for lock screen / notification controls.
 */
export function useMediaSession({
  onTogglePlayback,
  onSkipForward,
}: UseMediaSessionOptions): UseMediaSessionReturn {
  // Refs to avoid stale closures without causing re-initialization
  const toggleRef = useRef(onTogglePlayback);
  const skipRef = useRef(onSkipForward);
  toggleRef.current = onTogglePlayback;
  skipRef.current = onSkipForward;

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await TrackPlayer.setupPlayer({
          iosCategory: IOSCategory.PlayAndRecord,
          iosCategoryMode: IOSCategoryMode.VoiceChat,
          iosCategoryOptions: [
            IOSCategoryOptions.AllowBluetooth,
            IOSCategoryOptions.AllowBluetoothA2DP,
            IOSCategoryOptions.AllowAirPlay,
            IOSCategoryOptions.DefaultToSpeaker,
          ],
          autoHandleInterruptions: false,
        });
      } catch (err) {
        // setupPlayer throws if already initialized (e.g. Fast Refresh)
        if (
          err instanceof Error &&
          err.message.includes("already been initialized")
        ) {
          // Player already set up — continue
        } else {
          console.error("TrackPlayer.setupPlayer failed:", err);
          return;
        }
      }

      if (!mounted) return;

      await TrackPlayer.updateOptions({
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.SkipToNext,
        ],
        compactCapabilities: [Capability.Play, Capability.Pause],
      });

      await TrackPlayer.add({
        id: "silence",
        url: silenceAsset,
        title: "Alpha",
        artist: "Al Jazeera",
      });
      await TrackPlayer.setRepeatMode(RepeatMode.Track);
      await TrackPlayer.setVolume(0);
      await TrackPlayer.play();
    }

    init().catch((err) => console.error("Media session init failed:", err));

    const playSub = TrackPlayer.addEventListener(Event.RemotePlay, () => {
      toggleRef.current();
    });
    const pauseSub = TrackPlayer.addEventListener(Event.RemotePause, () => {
      toggleRef.current();
    });
    const nextSub = TrackPlayer.addEventListener(Event.RemoteNext, () => {
      skipRef.current();
    });

    return () => {
      mounted = false;
      playSub.remove();
      pauseSub.remove();
      nextSub.remove();
      TrackPlayer.reset().catch((err) =>
        console.error("TrackPlayer.reset failed:", err),
      );
    };
  }, []);

  const updateNowPlaying = useCallback((title: string, artist: string) => {
    TrackPlayer.updateNowPlayingMetadata({ title, artist }).catch((err) =>
      console.error("updateNowPlayingMetadata failed:", err),
    );
  }, []);

  return { updateNowPlaying };
}
