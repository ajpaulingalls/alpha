import { describe, expect, test } from "bun:test";
import { BrowseAgent } from "./BrowseAgent";
import { mockBrowseDeps } from "./test-helpers";

describe("BrowseAgent", () => {
  test("create() returns a BrowseAgent instance", () => {
    const agent = BrowseAgent.create(mockBrowseDeps());
    expect(agent).toBeInstanceOf(BrowseAgent);
  });
});
