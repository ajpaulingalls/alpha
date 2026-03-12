import { describe, expect, test } from "bun:test";
import { classifyContent, getExpiresAt, computeExpiry } from "./ExpiryRules";

describe("classifyContent", () => {
  test("classifies breaking news keywords", () => {
    expect(classifyContent("breaking news in Gaza", "")).toBe("breaking");
    expect(classifyContent("", "just in: ceasefire collapsed")).toBe(
      "breaking",
    );
    expect(classifyContent("developing story", "")).toBe("breaking");
    expect(classifyContent("URGENT update", "")).toBe("breaking");
  });

  test("classifies current events keywords", () => {
    expect(classifyContent("latest updates", "")).toBe("current");
    expect(classifyContent("what happened today", "")).toBe("current");
    expect(classifyContent("election results", "")).toBe("current");
    expect(classifyContent("summit meeting", "")).toBe("current");
  });

  test("classifies background topics", () => {
    expect(classifyContent("Syria conflict overview", "")).toBe("background");
    expect(classifyContent("climate change impact", "")).toBe("background");
    expect(classifyContent("global economy trends", "")).toBe("background");
  });

  test("defaults to evergreen for unmatched content", () => {
    expect(classifyContent("how does parliament work", "")).toBe("evergreen");
    expect(classifyContent("tell me about jazz", "")).toBe("evergreen");
  });

  test("is case insensitive", () => {
    expect(classifyContent("BREAKING NEWS", "")).toBe("breaking");
    expect(classifyContent("Latest Updates", "")).toBe("current");
    expect(classifyContent("CLIMATE change", "")).toBe("background");
  });

  test("checks both query and context", () => {
    expect(classifyContent("tell me more", "breaking news about")).toBe(
      "breaking",
    );
    expect(classifyContent("any updates", "summit talks context")).toBe(
      "current",
    );
  });

  test("breaking takes priority over other categories", () => {
    expect(classifyContent("breaking election news today", "")).toBe(
      "breaking",
    );
  });
});

describe("getExpiresAt", () => {
  test("returns date ~1 hour from now for breaking", () => {
    const before = Date.now();
    const result = getExpiresAt("breaking");
    const after = Date.now();
    const oneHourMs = 60 * 60 * 1000;
    expect(result.getTime()).toBeGreaterThanOrEqual(before + oneHourMs);
    expect(result.getTime()).toBeLessThanOrEqual(after + oneHourMs);
  });

  test("returns date ~6 hours from now for current", () => {
    const before = Date.now();
    const result = getExpiresAt("current");
    const sixHoursMs = 6 * 60 * 60 * 1000;
    expect(result.getTime()).toBeGreaterThanOrEqual(before + sixHoursMs);
  });

  test("returns date ~7 days from now for background", () => {
    const before = Date.now();
    const result = getExpiresAt("background");
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(result.getTime()).toBeGreaterThanOrEqual(before + sevenDaysMs);
  });

  test("returns date ~30 days from now for evergreen", () => {
    const before = Date.now();
    const result = getExpiresAt("evergreen");
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(result.getTime()).toBeGreaterThanOrEqual(before + thirtyDaysMs);
  });
});

describe("computeExpiry", () => {
  test("composes classification and expiry", () => {
    const before = Date.now();
    const result = computeExpiry("breaking news", "");
    const oneHourMs = 60 * 60 * 1000;
    expect(result.getTime()).toBeGreaterThanOrEqual(before + oneHourMs);
    expect(result.getTime()).toBeLessThanOrEqual(Date.now() + oneHourMs + 100);
  });

  test("defaults to 30-day expiry for generic queries", () => {
    const before = Date.now();
    const result = computeExpiry("tell me about music", "");
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(result.getTime()).toBeGreaterThanOrEqual(before + thirtyDaysMs);
  });
});
