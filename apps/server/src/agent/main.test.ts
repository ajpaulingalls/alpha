import { describe, expect, test, mock } from "bun:test";
import { createInactivityHandler } from "./inactivity";

describe("inactivity handler", () => {
  test("first away event does not trigger shutdown", () => {
    const onTimeout = mock(() => undefined);
    const onCheckIn = mock(() => undefined);
    const handler = createInactivityHandler({ onCheckIn, onTimeout });

    handler({ newState: "away" });

    expect(onTimeout).not.toHaveBeenCalled();
    expect(onCheckIn).toHaveBeenCalledTimes(1);
  });

  test("second consecutive away event triggers shutdown", () => {
    const onTimeout = mock(() => undefined);
    const onCheckIn = mock(() => undefined);
    const handler = createInactivityHandler({ onCheckIn, onTimeout });

    handler({ newState: "away" });
    handler({ newState: "away" });

    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(onCheckIn).toHaveBeenCalledTimes(1);
  });

  test("user speaking resets away counter", () => {
    const onTimeout = mock(() => undefined);
    const onCheckIn = mock(() => undefined);
    const handler = createInactivityHandler({ onCheckIn, onTimeout });

    handler({ newState: "away" });
    handler({ newState: "speaking" });
    handler({ newState: "listening" });
    handler({ newState: "away" });

    expect(onTimeout).not.toHaveBeenCalled();
    expect(onCheckIn).toHaveBeenCalledTimes(2);
  });
});

describe("shutdown callback", () => {
  test("calls endSession with session ID and user ID", async () => {
    const endSession = mock((_id: string, _uid: string) => Promise.resolve());
    const sessionId = "test-session-123";
    const userId = "user-456";

    const shutdownCallback = async () => {
      await endSession(sessionId, userId).catch((err: unknown) =>
        console.error("Failed to end session on shutdown:", err),
      );
    };

    await shutdownCallback();

    expect(endSession).toHaveBeenCalledWith(sessionId, userId);
  });

  test("does not throw when endSession fails", async () => {
    const endSession = mock((_id: string, _uid: string) =>
      Promise.reject(new Error("DB connection lost")),
    );
    const sessionId = "test-session-123";
    const userId = "user-456";

    const shutdownCallback = async () => {
      await endSession(sessionId, userId).catch((err) =>
        console.error("Failed to end session on shutdown:", err),
      );
    };

    await expect(shutdownCallback()).resolves.toBeUndefined();
  });
});
