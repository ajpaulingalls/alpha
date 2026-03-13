import { describe, expect, mock, spyOn, test } from "bun:test";
import { createNotifyClient, registerRemoteControls } from "./rpc";

function mockRoom(
  performRpc: (...args: unknown[]) => Promise<string> = () =>
    Promise.resolve(""),
) {
  return {
    localParticipant: {
      performRpc: mock(performRpc),
      registerRpcMethod: mock(() => undefined),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("createNotifyClient", () => {
  test("calls performRpc with correct arguments", () => {
    const room = mockRoom();
    const notify = createNotifyClient(room, "user-123");

    notify("client.showMode", { mode: "browse" });

    expect(room.localParticipant.performRpc).toHaveBeenCalledWith({
      destinationIdentity: "user-123",
      method: "client.showMode",
      payload: '{"mode":"browse"}',
    });
  });

  test("serializes payload as JSON", () => {
    const room = mockRoom();
    const notify = createNotifyClient(room, "user-456");

    notify("client.showTopic", {
      title: "Breaking News",
      summary: "Something happened",
    });

    expect(room.localParticipant.performRpc).toHaveBeenCalledWith({
      destinationIdentity: "user-456",
      method: "client.showTopic",
      payload: '{"title":"Breaking News","summary":"Something happened"}',
    });
  });

  test("catches and logs errors without throwing", async () => {
    const error = new Error("RPC failed");
    const room = mockRoom(() => Promise.reject(error));
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const consoleSpy = spyOn(console, "error").mockImplementation(() => {});

    const notify = createNotifyClient(room, "user-789");
    notify("client.showMode", { mode: "setup" });

    // Wait for the promise rejection to be handled
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("registerRemoteControls", () => {
  test("registers two RPC methods on localParticipant", () => {
    const room = mockRoom();
    const controls = {
      onTogglePlayback: mock(() => undefined),
      onSkipForward: mock(() => undefined),
    };

    registerRemoteControls(room, "user-1", controls);

    expect(room.localParticipant.registerRpcMethod).toHaveBeenCalledTimes(2);
    const calls = room.localParticipant.registerRpcMethod.mock.calls;
    expect(calls[0][0]).toBe("agent.togglePlayback");
    expect(calls[1][0]).toBe("agent.skipForward");
  });

  test("togglePlayback handler calls onTogglePlayback for matching caller", async () => {
    const room = mockRoom();
    const controls = {
      onTogglePlayback: mock(() => undefined),
      onSkipForward: mock(() => undefined),
    };

    registerRemoteControls(room, "user-1", controls);

    const handler = room.localParticipant.registerRpcMethod.mock.calls[0][1];
    const result = await handler({ callerIdentity: "user-1", payload: "" });

    expect(controls.onTogglePlayback).toHaveBeenCalledTimes(1);
    expect(result).toBe("");
  });

  test("togglePlayback handler ignores non-matching caller", async () => {
    const room = mockRoom();
    const controls = {
      onTogglePlayback: mock(() => undefined),
      onSkipForward: mock(() => undefined),
    };

    registerRemoteControls(room, "user-1", controls);

    const handler = room.localParticipant.registerRpcMethod.mock.calls[0][1];
    await handler({ callerIdentity: "attacker", payload: "" });

    expect(controls.onTogglePlayback).not.toHaveBeenCalled();
  });

  test("skipForward handler calls onSkipForward for matching caller", async () => {
    const room = mockRoom();
    const controls = {
      onTogglePlayback: mock(() => undefined),
      onSkipForward: mock(() => undefined),
    };

    registerRemoteControls(room, "user-1", controls);

    const handler = room.localParticipant.registerRpcMethod.mock.calls[1][1];
    const result = await handler({ callerIdentity: "user-1", payload: "" });

    expect(controls.onSkipForward).toHaveBeenCalledTimes(1);
    expect(result).toBe("");
  });

  test("throttles rapid togglePlayback calls", async () => {
    const room = mockRoom();
    const controls = {
      onTogglePlayback: mock(() => undefined),
      onSkipForward: mock(() => undefined),
    };

    registerRemoteControls(room, "user-1", controls);

    const handler = room.localParticipant.registerRpcMethod.mock.calls[0][1];
    await handler({ callerIdentity: "user-1", payload: "" });
    await handler({ callerIdentity: "user-1", payload: "" });
    await handler({ callerIdentity: "user-1", payload: "" });

    expect(controls.onTogglePlayback).toHaveBeenCalledTimes(1);
  });

  test("throttles rapid skipForward calls", async () => {
    const room = mockRoom();
    const controls = {
      onTogglePlayback: mock(() => undefined),
      onSkipForward: mock(() => undefined),
    };

    registerRemoteControls(room, "user-1", controls);

    const handler = room.localParticipant.registerRpcMethod.mock.calls[1][1];
    await handler({ callerIdentity: "user-1", payload: "" });
    await handler({ callerIdentity: "user-1", payload: "" });
    await handler({ callerIdentity: "user-1", payload: "" });

    expect(controls.onSkipForward).toHaveBeenCalledTimes(1);
  });
});
