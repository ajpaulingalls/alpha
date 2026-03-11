import { describe, expect, test } from "bun:test";
import { CatchUpAgent } from "./CatchUpAgent";

describe("CatchUpAgent", () => {
  test("create() returns a CatchUpAgent instance", () => {
    const agent = CatchUpAgent.create();
    expect(agent).toBeInstanceOf(CatchUpAgent);
  });
});
