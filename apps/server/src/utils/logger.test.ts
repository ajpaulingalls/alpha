import { afterEach, describe, expect, mock, test } from "bun:test";

// The logger module uses module-level state, so we re-import for each test
// via dynamic import after resetting the module registry.
// However, Bun doesn't support module cache busting easily, so instead
// we test the enable/disable toggling on the singleton.

import { logger } from "./logger";

describe("logger", () => {
  const originalLog = console.log;
  const originalDebug = console.debug;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalError = console.error;

  afterEach(() => {
    console.log = originalLog;
    console.debug = originalDebug;
    console.warn = originalWarn;
    console.info = originalInfo;
    console.error = originalError;
  });

  test("when enabled, log/debug/warn/info call their console methods", () => {
    logger.enable();

    const logFn = mock(() => undefined);
    const debugFn = mock(() => undefined);
    const warnFn = mock(() => undefined);
    const infoFn = mock(() => undefined);

    console.log = logFn;
    console.debug = debugFn;
    console.warn = warnFn;
    console.info = infoFn;

    logger.log("test log");
    logger.debug("test debug");
    logger.warn("test warn");
    logger.info("test info");

    expect(logFn).toHaveBeenCalledWith("test log");
    expect(debugFn).toHaveBeenCalledWith("test debug");
    expect(warnFn).toHaveBeenCalledWith("test warn");
    expect(infoFn).toHaveBeenCalledWith("test info");
  });

  test("when disabled, log/debug/warn/info do NOT call console methods", () => {
    logger.disable();

    const logFn = mock(() => undefined);
    const debugFn = mock(() => undefined);
    const warnFn = mock(() => undefined);
    const infoFn = mock(() => undefined);

    console.log = logFn;
    console.debug = debugFn;
    console.warn = warnFn;
    console.info = infoFn;

    logger.log("test log");
    logger.debug("test debug");
    logger.warn("test warn");
    logger.info("test info");

    expect(logFn).not.toHaveBeenCalled();
    expect(debugFn).not.toHaveBeenCalled();
    expect(warnFn).not.toHaveBeenCalled();
    expect(infoFn).not.toHaveBeenCalled();
  });

  test("error ALWAYS calls console.error regardless of enabled state", () => {
    logger.disable();

    const errorFn = mock(() => undefined);
    console.error = errorFn;

    logger.error("critical error");

    expect(errorFn).toHaveBeenCalledWith("critical error");
  });

  test("enable() and disable() toggle correctly", () => {
    const logFn = mock(() => undefined);
    console.log = logFn;

    logger.disable();
    logger.log("should not appear");
    expect(logFn).not.toHaveBeenCalled();

    logger.enable();
    logger.log("should appear");
    expect(logFn).toHaveBeenCalledTimes(1);
  });
});
