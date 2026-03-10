export const DEFAULT_TIMEOUT_MS = 15_000;

const MAX_ERROR_BODY_LENGTH = 1024;

export async function assertOk(response: Response): Promise<void> {
  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    const body =
      raw.length > MAX_ERROR_BODY_LENGTH
        ? raw.slice(0, MAX_ERROR_BODY_LENGTH)
        : raw;
    throw new Error(
      `HTTP ${response.status}: ${response.statusText}${
        body ? ` — ${body}` : ""
      }`
    );
  }
}
