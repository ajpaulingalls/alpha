import { describe, expect, test } from "bun:test";
import { BrowseAgent } from "./BrowseAgent";

describe("BrowseAgent", () => {
  test("create() returns a BrowseAgent instance", () => {
    const agent = BrowseAgent.create();
    expect(agent).toBeInstanceOf(BrowseAgent);
  });
});
