import { describe, expect, test, mock, beforeEach } from "bun:test";
import { CortexClient } from "./client.ts";

// --- Helpers ---

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(events: string[]): Response {
  const text = events.join("\n") + "\n";
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(body, { status: 200, statusText: "OK" });
}

let fetchMock: ReturnType<typeof mock>;

beforeEach(() => {
  fetchMock = mock();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

// --- Tests ---

describe("CortexClient", () => {
  describe("constructor", () => {
    test("accepts bare string URL and strips trailing slashes", () => {
      const client = new CortexClient("https://cortex.example.com///");
      // Verify by making a call — URL should not have trailing slashes
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: { test: { result: "ok" } },
        })
      );
      client.callPathway("test", { text: "hi" });
      const url = (fetchMock.mock.calls[0] as unknown[])[0] as string;
      expect(url).toBe("https://cortex.example.com/graphql");
    });

    test("accepts CortexClientConfig object", () => {
      const client = new CortexClient({
        baseUrl: "https://cortex.example.com/",
        apiKey: "secret",
        defaultModel: "gpt-4",
      });
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ choices: [{ message: { content: "hi" } }] })
      );
      client.chatCompletion([{ role: "user", content: "hello" }]);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["ocp-apim-subscription-key"]).toBe("secret");
    });
  });

  describe("auth headers", () => {
    test("includes ocp-apim-subscription-key when apiKey is configured", async () => {
      const client = new CortexClient({
        baseUrl: "https://cortex.example.com",
        apiKey: "my-key",
      });
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { test: { result: "ok" } } })
      );
      await client.callPathway("test", {});
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["ocp-apim-subscription-key"]).toBe("my-key");
    });

    test("omits ocp-apim-subscription-key when apiKey is not configured", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { test: { result: "ok" } } })
      );
      await client.callPathway("test", {});
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["ocp-apim-subscription-key"]).toBeUndefined();
    });
  });

  describe("callPathway — GraphQL query construction", () => {
    test("builds correct GraphQL query with typed variables", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: { summary: { result: "summarized", resultData: null } },
        })
      );

      await client.callPathway("summary", {
        text: "hello",
        targetLength: 100,
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.query).toContain("$text: String");
      expect(body.query).toContain("$targetLength: Int");
      expect(body.query).toContain("query summary(");
      expect(body.query).toContain(
        "summary(text: $text, targetLength: $targetLength)"
      );
      expect(body.variables).toEqual({ text: "hello", targetLength: 100 });
    });

    test("infers Float type for non-integer numbers", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { test: { result: "ok" } } })
      );

      await client.callPathway("test", { temperature: 0.7 });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.query).toContain("$temperature: Float");
    });

    test("infers Boolean type", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { test: { result: "ok" } } })
      );

      await client.callPathway("test", { verbose: true });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.query).toContain("$verbose: Boolean");
    });

    test("infers [String] type for string arrays", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { test: { result: "ok" } } })
      );

      await client.callPathway("test", { tags: ["a", "b"] });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.query).toContain("$tags: [String]");
    });

    test("filters out undefined params", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ data: { test: { result: "ok" } } })
      );

      await client.callPathway("test", {
        text: "hello",
        missing: undefined,
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.variables).toEqual({ text: "hello" });
      expect(body.query).not.toContain("missing");
    });
  });

  describe("callPathway — GraphQL response parsing", () => {
    test("extracts result, resultData, warnings, errors from response", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            summary: {
              result: "the summary",
              resultData: '{"key":"val"}',
              tool: null,
              warnings: ["warn1"],
              errors: null,
              contextId: "ctx-123",
              debug: null,
            },
          },
        })
      );

      const res = await client.callPathway("summary", { text: "hi" });
      expect(res.result).toBe("the summary");
      expect(res.resultData).toBe('{"key":"val"}');
      expect(res.warnings).toEqual(["warn1"]);
      expect(res.errors).toBeNull();
      expect(res.contextId).toBe("ctx-123");
    });
  });

  describe("chatCompletion", () => {
    test("sends to /v1/chat/completions and extracts content", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "Hello there!" } }],
        })
      );

      const result = await client.chatCompletion([
        { role: "user", content: "Hi" },
      ]);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://cortex.example.com/v1/chat/completions");
      const body = JSON.parse(init.body as string);
      expect(body.messages).toEqual([{ role: "user", content: "Hi" }]);
      expect(body.stream).toBeUndefined();
      expect(result).toBe("Hello there!");
    });

    test("uses defaultModel when no model specified", async () => {
      const client = new CortexClient({
        baseUrl: "https://cortex.example.com",
        defaultModel: "gpt-4o",
      });
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "ok" } }],
        })
      );

      await client.chatCompletion([{ role: "user", content: "Hi" }]);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe("gpt-4o");
    });

    test("uses explicit model over defaultModel", async () => {
      const client = new CortexClient({
        baseUrl: "https://cortex.example.com",
        defaultModel: "gpt-4o",
      });
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "ok" } }],
        })
      );

      await client.chatCompletion([{ role: "user", content: "Hi" }], "gpt-3.5");

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.model).toBe("gpt-3.5");
    });
  });

  describe("streamChatCompletion — SSE streaming", () => {
    test("yields delta content chunks and stops on [DONE]", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        sseResponse([
          `data: ${JSON.stringify({
            choices: [{ delta: { content: "Hello" } }],
          })}`,
          `data: ${JSON.stringify({
            choices: [{ delta: { content: " world" } }],
          })}`,
          `data: [DONE]`,
        ])
      );

      const chunks: string[] = [];
      for await (const chunk of client.streamChatCompletion([
        { role: "user", content: "Hi" },
      ])) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(["Hello", " world"]);
    });

    test("sends stream:true in request body", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(sseResponse([`data: [DONE]`]));

      const chunks: string[] = [];
      for await (const chunk of client.streamChatCompletion([
        { role: "user", content: "Hi" },
      ])) {
        chunks.push(chunk);
      }

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.stream).toBe(true);
    });

    test("skips chunks with no delta content", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        sseResponse([
          `data: ${JSON.stringify({
            choices: [{ delta: { role: "assistant" } }],
          })}`,
          `data: ${JSON.stringify({
            choices: [{ delta: { content: "hi" } }],
          })}`,
          `data: [DONE]`,
        ])
      );

      const chunks: string[] = [];
      for await (const chunk of client.streamChatCompletion([
        { role: "user", content: "Hi" },
      ])) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(["hi"]);
    });
  });

  describe("convenience methods", () => {
    test("summarize returns result string", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: { summary: { result: "Short version." } },
        })
      );

      const result = await client.summarize("Long text...", 50);
      expect(result).toBe("Short version.");

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.variables.text).toBe("Long text...");
      expect(body.variables.targetLength).toBe(50);
    });

    test("search parses value array from result", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            cognitive_search: {
              result: JSON.stringify({
                value: [{ title: "Article 1", content: "Body 1", score: 0.95 }],
              }),
            },
          },
        })
      );

      const results = await client.search("test query");
      expect(results).toEqual([
        { title: "Article 1", content: "Body 1", score: 0.95 },
      ]);
    });

    test("search returns empty array on parse failure", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: { cognitive_search: { result: "not json" } },
        })
      );

      const results = await client.search("test");
      expect(results).toEqual([]);
    });

    test("embed parses embedding arrays from result", async () => {
      const client = new CortexClient("https://cortex.example.com");
      const embedding = [0.1, 0.2, 0.3];
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            embeddings: {
              result: JSON.stringify({
                data: [{ embedding }],
              }),
            },
          },
        })
      );

      const result = await client.embed("test text");
      expect(result).toEqual([embedding]);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.variables.input).toEqual(["test text"]);
      expect(body.variables.model).toBe("oai-text-embedding-3-small");
    });

    test("rag extracts citations from tool field", async () => {
      const client = new CortexClient("https://cortex.example.com");
      const citations = [
        { title: "Source 1", content: "snippet", url: "https://example.com" },
      ];
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            rag: {
              result: "RAG answer",
              tool: JSON.stringify({ citations }),
              resultData: null,
            },
          },
        })
      );

      const result = await client.rag("what is X?");
      expect(result.result).toBe("RAG answer");
      expect(result.sources).toEqual(citations);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.variables.chatHistory).toEqual([
        { role: "user", content: "what is X?" },
      ]);
    });

    test("rag returns empty sources when tool field is absent", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            rag: { result: "answer", tool: null, resultData: null },
          },
        })
      );

      const result = await client.rag("query");
      expect(result.sources).toEqual([]);
    });

    test("rag passes options to pathway params", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          data: {
            rag: { result: "answer", tool: null, resultData: null },
          },
        })
      );

      await client.rag("query", {
        indexName: "my-index",
        searchBing: true,
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.variables.indexName).toBe("my-index");
      expect(body.variables.searchBing).toBe(true);
    });
  });

  describe("error handling", () => {
    test("throws on non-2xx HTTP status with response body", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        new Response("Something went wrong", {
          status: 500,
          statusText: "Internal Server Error",
        })
      );

      await expect(client.callPathway("test", { text: "hi" })).rejects.toThrow(
        "HTTP 500: Internal Server Error — Something went wrong"
      );
    });

    test("throws on GraphQL errors in response body", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          errors: [{ message: "Pathway not found" }],
        })
      );

      await expect(
        client.callPathway("missing", { text: "hi" })
      ).rejects.toThrow("GraphQL error: Pathway not found");
    });

    test("throws when no data returned for pathway", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(jsonResponse({ data: {} }));

      await expect(client.callPathway("test", { text: "hi" })).rejects.toThrow(
        'No data returned for pathway "test"'
      );
    });

    test("throws on non-2xx for chatCompletion", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        new Response("Unauthorized", {
          status: 401,
          statusText: "Unauthorized",
        })
      );

      await expect(
        client.chatCompletion([{ role: "user", content: "hi" }])
      ).rejects.toThrow("HTTP 401");
    });

    test("throws on non-2xx for streamChatCompletion", async () => {
      const client = new CortexClient("https://cortex.example.com");
      fetchMock.mockResolvedValueOnce(
        new Response("Bad Request", { status: 400, statusText: "Bad Request" })
      );

      await expect(async () => {
        for await (const _ of client.streamChatCompletion([
          { role: "user", content: "hi" },
        ])) {
          // should not reach here
        }
      }).toThrow("HTTP 400");
    });
  });
});
