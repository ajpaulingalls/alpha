import type { Room } from "@livekit/rtc-node";
import type { RPCMethodMap } from "@alpha/socket/RPCMethods";

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
