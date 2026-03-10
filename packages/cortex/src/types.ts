// Public types

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface SearchResult {
  title: string;
  content: string;
  url?: string;
  score?: number;
}

export interface RagOptions {
  indexName?: string;
  searchBing?: boolean;
}

export interface RagResult {
  result: string;
  sources: SearchResult[];
}

export interface PathwayResponse {
  result: string;
  resultData?: string | null;
  tool?: string | null;
  warnings?: string[] | null;
  errors?: string[] | null;
  contextId?: string | null;
  debug?: string | null;
}

// Internal / config types

export interface CortexClientConfig {
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  /** Request timeout in milliseconds (default: 30 000) */
  timeoutMs?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices?: {
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }[];
}

export interface GraphQLResponse<T> {
  data?: Record<string, T>;
  errors?: { message: string }[];
}
