import type { Room } from "@livekit/rtc-node";
import {
  type RPCMethodMap,
  RPC_TOGGLE_PLAYBACK,
  RPC_SKIP_FORWARD,
} from "@alpha/socket/RPCMethods";

export type NotifyClient = <M extends keyof RPCMethodMap>(
  method: M,
  payload: RPCMethodMap[M],
) => void;

export function createNotifyClient(
  room: Room,
  participantIdentity: string,
): NotifyClient {
  return (method, payload) => {
    room.localParticipant
      ?.performRpc({
        destinationIdentity: participantIdentity,
        method,
        payload: JSON.stringify(payload),
      })
      .catch((err: unknown) =>
        console.error(`RPC ${method} to ${participantIdentity} failed:`, err),
      );
  };
}

export interface RemoteControls {
  onTogglePlayback: () => void;
  onSkipForward: () => void;
}

const RPC_THROTTLE_MS = 200;

export function registerRemoteControls(
  room: Room,
  participantIdentity: string,
  controls: RemoteControls,
): void {
  let lastToggle = 0;
  let lastSkip = 0;

  room.localParticipant?.registerRpcMethod(
    RPC_TOGGLE_PLAYBACK,
    async (data) => {
      if (data.callerIdentity !== participantIdentity) return "";
      const now = Date.now();
      if (now - lastToggle < RPC_THROTTLE_MS) return "";
      lastToggle = now;
      controls.onTogglePlayback();
      return "";
    },
  );

  room.localParticipant?.registerRpcMethod(RPC_SKIP_FORWARD, async (data) => {
    if (data.callerIdentity !== participantIdentity) return "";
    const now = Date.now();
    if (now - lastSkip < RPC_THROTTLE_MS) return "";
    lastSkip = now;
    controls.onSkipForward();
    return "";
  });
}
