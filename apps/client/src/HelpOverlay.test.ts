import { describe, expect, test, mock } from "bun:test";

mock.module("react-native", () => ({
  Modal: "Modal",
  ScrollView: "ScrollView",
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  View: "View",
}));

describe("HelpOverlay", () => {
  test("module exports HelpOverlay function", async () => {
    const mod = await import("./HelpOverlay");
    expect(typeof mod.HelpOverlay).toBe("function");
  });
});
