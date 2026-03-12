import { describe, expect, mock, spyOn, test } from "bun:test";
import { createNotifyClient } from "./rpc";

function mockRoom(
  performRpc: (...args: unknown[]) => Promise<string> = () =>
    Promise.resolve(""),
) {
  return {
    localParticipant: {
      performRpc: mock(performRpc),
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
