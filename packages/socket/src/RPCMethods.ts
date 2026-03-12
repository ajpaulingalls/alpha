// RPC method name constants (agent → client)
export const RPC_SHOW_TOPIC = "client.showTopic";
export const RPC_SHOW_PODCAST = "client.showPodcast";
export const RPC_SHOW_PROGRESS = "client.showProgress";
export const RPC_SHOW_MODE = "client.showMode";
export const RPC_SHOW_LOADING = "client.showLoading";
export const RPC_SHOW_TRANSCRIPT = "client.showTranscript";

// Payload interfaces

export interface ShowTopicPayload {
  title: string;
  summary: string;
  imageUrl?: string;
}

export interface ShowPodcastPayload {
  title: string;
  show: string;
  duration: number;
}

export interface ShowProgressPayload {
  items: number;
  current: number;
}

export type SessionMode = "setup" | "catchup" | "browse" | "playback";

export interface ShowModePayload {
  mode: SessionMode;
}

export interface ShowLoadingPayload {
  message?: string;
}

export interface ShowTranscriptPayload {
  text: string;
}

// Type-safe mapping from RPC method names to their payload types
export interface RPCMethodMap {
  "client.showTopic": ShowTopicPayload;
  "client.showPodcast": ShowPodcastPayload;
  "client.showProgress": ShowProgressPayload;
  "client.showMode": ShowModePayload;
  "client.showLoading": ShowLoadingPayload;
  "client.showTranscript": ShowTranscriptPayload;
}
