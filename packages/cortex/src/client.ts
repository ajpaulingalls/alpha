import type {
  ChatMessage,
  ChatCompletionResponse,
  ChatCompletionChunk,
  CortexClientConfig,
  GraphQLResponse,
  PathwayResponse,
  RagOptions,
  RagResult,
  SearchResult,
} from "./types.ts";

async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `HTTP ${response.status}: ${response.statusText}${
        body ? ` — ${body}` : ""
      }`
    );
  }
}

function inferGraphQLType(value: unknown): string {
  if (typeof value === "boolean") return "Boolean";
  if (typeof value === "number")
    return Number.isInteger(value) ? "Int" : "Float";
  if (typeof value === "string") return "String";
  if (Array.isArray(value)) {
    if (value.length > 0 && typeof value[0] === "string") return "[String]";
    if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
      if ("role" in value[0] && "content" in value[0]) {
        if (Array.isArray(value[0].content)) return "[MultiMessage]";
        return "[Message]";
      }
    }
    return "[String]";
  }
  return "String";
}

async function* parseSSEStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          try {
            const chunk = JSON.parse(data) as ChatCompletionChunk;
            const content = chunk.choices[0]?.delta?.content;
            if (content) yield content;
          } catch {
            // skip malformed JSON lines
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export class CortexClient {
  private baseUrl: string;
  private apiKey?: string;
  private defaultModel?: string;

  constructor(config: string | CortexClientConfig) {
    if (typeof config === "string") {
      this.baseUrl = config.replace(/\/+$/, "");
    } else {
      this.baseUrl = config.baseUrl.replace(/\/+$/, "");
      this.apiKey = config.apiKey;
      this.defaultModel = config.defaultModel;
    }
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      accept: "application/json",
      "Content-Type": "application/json",
    };
    if (this.apiKey) h["ocp-apim-subscription-key"] = this.apiKey;
    return h;
  }

  // --- Core methods ---

  async callPathway(
    name: string,
    params: Record<string, unknown> = {}
  ): Promise<PathwayResponse> {
    const entries = Object.entries(params).filter(([, v]) => v !== undefined);

    const variableDefs = entries
      .map(([key, value]) => `$${key}: ${inferGraphQLType(value)}`)
      .join(", ");
    const queryArgs = entries.map(([key]) => `${key}: $${key}`).join(", ");

    const query = `query ${name}(${variableDefs}) { ${name}(${queryArgs}) { result resultData tool warnings errors contextId debug } }`;
    const variables = Object.fromEntries(entries);

    const response = await fetch(`${this.baseUrl}/graphql`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ query, variables }),
    });
    await assertOk(response);

    const json = (await response.json()) as GraphQLResponse<PathwayResponse>;

    if (json.errors?.length) {
      throw new Error(`GraphQL error: ${json.errors[0].message}`);
    }

    const data = json.data?.[name];
    if (!data) {
      throw new Error(`No data returned for pathway "${name}"`);
    }

    return data;
  }

  async *streamPathway(
    name: string,
    params: Record<string, unknown> = {}
  ): AsyncGenerator<string> {
    const systemContent = `Use the ${name} pathway. Parameters: ${JSON.stringify(
      params
    )}`;
    const messages: ChatMessage[] = [
      { role: "system", content: systemContent },
      {
        role: "user",
        content: typeof params.text === "string" ? params.text : "",
      },
    ];

    yield* this.streamChatCompletion(messages);
  }

  private async fetchChatCompletions(
    messages: ChatMessage[],
    model?: string,
    stream?: boolean
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: model ?? this.defaultModel ?? "default",
        messages,
        ...(stream && { stream: true }),
      }),
    });
    await assertOk(response);
    return response;
  }

  async chatCompletion(
    messages: ChatMessage[],
    model?: string
  ): Promise<string> {
    const response = await this.fetchChatCompletions(messages, model);
    const json = (await response.json()) as ChatCompletionResponse;
    return json.choices[0].message.content;
  }

  async *streamChatCompletion(
    messages: ChatMessage[],
    model?: string
  ): AsyncGenerator<string> {
    const response = await this.fetchChatCompletions(messages, model, true);

    if (!response.body) {
      throw new Error("No response body for streaming request");
    }

    yield* parseSSEStream(response.body);
  }

  // --- Convenience methods ---

  async summarize(text: string, targetLength?: number): Promise<string> {
    const params: Record<string, unknown> = { text };
    if (targetLength !== undefined) params.targetLength = targetLength;
    const res = await this.callPathway("summary", params);
    return res.result;
  }

  async search(query: string, indexName?: string): Promise<SearchResult[]> {
    const params: Record<string, unknown> = { text: query };
    if (indexName !== undefined) params.indexName = indexName;
    const res = await this.callPathway("cognitive_search", params);
    try {
      const parsed = JSON.parse(res.result);
      return (parsed.value ?? []) as SearchResult[];
    } catch {
      return [];
    }
  }

  async embed(text: string): Promise<number[][]> {
    const res = await this.callPathway("embeddings", {
      input: [text],
      model: "oai-text-embedding-3-small",
    });
    try {
      const parsed = JSON.parse(res.result);
      return (parsed.data ?? []).map(
        (item: { embedding: number[] }) => item.embedding
      );
    } catch {
      return [];
    }
  }

  async rag(query: string, options?: RagOptions): Promise<RagResult> {
    const chatHistory: ChatMessage[] = [{ role: "user", content: query }];
    const params: Record<string, unknown> = { chatHistory };
    if (options?.indexName) params.indexName = options.indexName;
    if (options?.searchBing !== undefined)
      params.searchBing = options.searchBing;

    const res = await this.callPathway("rag", params);

    let sources: SearchResult[] = [];
    if (res.tool) {
      try {
        const toolData = JSON.parse(res.tool);
        sources = (toolData.citations ?? []) as SearchResult[];
      } catch {
        // no citations available
      }
    }

    return { result: res.result, sources };
  }
}
