/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, mock, beforeEach } from "bun:test";

function createMockResult(data: any[]) {
  const chain: Record<string, any> = {};
  const methods = [
    "from",
    "where",
    "orderBy",
    "limit",
    "set",
    "values",
    "returning",
  ];
  for (const m of methods) {
    chain[m] = mock(() => {
      if (m === "returning") return Promise.resolve(data);
      return chain;
    });
  }
  chain.then = (resolve: (v: any) => any) =>
    Promise.resolve(data).then(resolve);
  return chain;
}

let mockSelectResult: any[] = [];
let mockInsertResult: any[] = [];

const mockDb = {
  select: mock(() => createMockResult(mockSelectResult)),
  insert: mock(() => createMockResult(mockInsertResult)),
};

mock.module("../client", () => ({ db: mockDb }));

const {
  createTopic,
  createTopics,
  findTopicsByEpisode,
  findTopicById,
  searchTopicsByEmbedding,
} = await import("./topics");

describe("topics CRUD", () => {
  beforeEach(() => {
    mockSelectResult = [];
    mockInsertResult = [];
  });

  test("createTopic returns created topic", async () => {
    const topic: any = { id: "t1", title: "Topic 1", summary: "Summary" };
    mockInsertResult = [topic];
    const result = await createTopic({
      title: "Topic 1",
      summary: "Summary",
      filename: "file.mp3",
    });
    expect(result).toEqual(topic);
  });

  test("createTopics returns array of created topics", async () => {
    const topics: any[] = [
      { id: "t1", title: "Topic 1" },
      { id: "t2", title: "Topic 2" },
    ];
    mockInsertResult = topics;
    const result = await createTopics([
      { title: "Topic 1", summary: "S1", filename: "f1.mp3" },
      { title: "Topic 2", summary: "S2", filename: "f2.mp3" },
    ]);
    expect(result).toEqual(topics);
  });

  test("findTopicsByEpisode returns array of topics", async () => {
    const topics: any[] = [{ id: "t1" }, { id: "t2" }];
    mockSelectResult = topics;
    const result = await findTopicsByEpisode("e1");
    expect(result).toEqual(topics);
  });

  test("findTopicsByEpisode returns empty array when none found", async () => {
    mockSelectResult = [];
    const result = await findTopicsByEpisode("missing");
    expect(result).toEqual([]);
  });

  test("findTopicById returns topic when found", async () => {
    const topic: any = { id: "t1", title: "Topic 1" };
    mockSelectResult = [topic];
    const result = await findTopicById("t1");
    expect(result).toEqual(topic);
  });

  test("findTopicById returns null when not found", async () => {
    mockSelectResult = [];
    const result = await findTopicById("missing");
    expect(result).toBeNull();
  });

  test("searchTopicsByEmbedding accepts embedding array and returns results", async () => {
    const topics: any[] = [
      { id: "t1", title: "Topic 1", distance: 0.1 },
      { id: "t2", title: "Topic 2", distance: 0.2 },
    ];
    mockSelectResult = topics;
    const embedding = new Array(1536).fill(0.1);
    const result = await searchTopicsByEmbedding(embedding, 5);
    expect(result).toEqual(topics);
  });
});
