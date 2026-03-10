import { mock, beforeEach } from "bun:test";

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? "OK" : "Error",
    headers: { "Content-Type": "application/json" },
  });
}

export let fetchMock: ReturnType<typeof mock>;

export function fetchUrl(): string {
  return (fetchMock.mock.calls[0] as unknown[])[0] as string;
}

export function fetchInit(): RequestInit {
  return (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
}

export function setupFetchMock(): void {
  beforeEach(() => {
    fetchMock = mock();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
}
