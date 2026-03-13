import { describe, expect, test, mock, beforeEach } from "bun:test";

// Mock react-native-track-player before importing the hook
const mockSetupPlayer = mock(() => Promise.resolve());
const mockUpdateOptions = mock(() => Promise.resolve());
const mockAdd = mock(() => Promise.resolve());
const mockSetRepeatMode = mock(() => Promise.resolve());
const mockSetVolume = mock(() => Promise.resolve());
const mockPlay = mock(() => Promise.resolve());
const mockReset = mock(() => Promise.resolve());
const mockUpdateNowPlayingMetadata = mock(() => Promise.resolve());
const mockAddEventListener = mock(
  (_event: string, _cb: () => void) =>
    ({ remove: mock(() => undefined) }) as { remove: () => void },
);

mock.module("react-native-track-player", () => ({
  __esModule: true,
  default: {
    setupPlayer: mockSetupPlayer,
    updateOptions: mockUpdateOptions,
    add: mockAdd,
    setRepeatMode: mockSetRepeatMode,
    setVolume: mockSetVolume,
    play: mockPlay,
    reset: mockReset,
    updateNowPlayingMetadata: mockUpdateNowPlayingMetadata,
    addEventListener: mockAddEventListener,
  },
  Event: {
    RemotePlay: "remote-play",
    RemotePause: "remote-pause",
    RemoteNext: "remote-next",
  },
  RepeatMode: { Off: 0, Track: 1, Queue: 2 },
  Capability: {
    Play: 0,
    Pause: 1,
    SkipToNext: 4,
  },
  IOSCategory: { PlayAndRecord: "playAndRecord" },
  IOSCategoryMode: { VoiceChat: "voiceChat" },
  IOSCategoryOptions: {
    AllowBluetooth: "allowBluetooth",
    AllowBluetoothA2DP: "allowBluetoothA2DP",
    AllowAirPlay: "allowAirPlay",
    DefaultToSpeaker: "defaultToSpeaker",
  },
}));

// Mock the silence asset require
mock.module("../assets/silence.mp3", () => ({ default: 42 }));

describe("useMediaSession", () => {
  beforeEach(() => {
    mockSetupPlayer.mockClear();
    mockUpdateOptions.mockClear();
    mockAdd.mockClear();
    mockSetRepeatMode.mockClear();
    mockSetVolume.mockClear();
    mockPlay.mockClear();
    mockReset.mockClear();
    mockUpdateNowPlayingMetadata.mockClear();
    mockAddEventListener.mockClear();
  });

  test("module exports useMediaSession function", async () => {
    const mod = await import("./useMediaSession");
    expect(typeof mod.useMediaSession).toBe("function");
  });

  test("mock functions are properly configured", () => {
    expect(typeof mockSetupPlayer).toBe("function");
    expect(typeof mockAddEventListener).toBe("function");
    expect(typeof mockUpdateNowPlayingMetadata).toBe("function");
    expect(typeof mockAdd).toBe("function");
    expect(typeof mockPlay).toBe("function");
    expect(typeof mockReset).toBe("function");
    expect(typeof mockSetVolume).toBe("function");
    expect(typeof mockUpdateOptions).toBe("function");
    expect(typeof mockSetRepeatMode).toBe("function");
  });
});
