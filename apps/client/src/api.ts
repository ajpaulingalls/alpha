import { Alert } from "react-native";
import Constants from "expo-constants";

const configuredApiUrl = Constants.expoConfig?.extra?.apiUrl as
  | string
  | undefined;

function getApiUrl(): string {
  if (configuredApiUrl) return configuredApiUrl;
  if (__DEV__) return "http://localhost:8081";
  throw new Error("EXPO_PUBLIC_API_URL must be set for production builds");
}

const API_URL = getApiUrl();

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

async function throwIfNotOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 401) throw new UnauthorizedError();
  const body = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  throw new Error(body?.error ?? `${fallback} (${res.status})`);
}

export function alertError(err: unknown): void {
  Alert.alert("Error", err instanceof Error ? err.message : "Unknown error");
}

export async function sendCode(email: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/send-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  await throwIfNotOk(res, "Request failed");
}

export async function verifyCode(
  email: string,
  code: string,
): Promise<{ token: string; isNewUser: boolean }> {
  const res = await fetch(`${API_URL}/api/auth/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  await throwIfNotOk(res, "Verification failed");
  return (await res.json()) as { token: string; isNewUser: boolean };
}

export async function fetchLiveKitToken(
  userToken: string,
): Promise<{ token: string; roomName: string }> {
  const res = await fetch(`${API_URL}/api/auth/livekit-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
  });
  await throwIfNotOk(res, "Token fetch failed");
  return (await res.json()) as { token: string; roomName: string };
}

export type CatchUpDepth = "brief" | "standard" | "detailed";

export interface UserPreferencesResponse {
  user: { name: string; email: string };
  preferences: {
    timezone: string | null;
    catchUpDepth: CatchUpDepth;
    preferences: Record<string, unknown>;
  };
}

export async function fetchPreferences(
  userToken: string,
): Promise<UserPreferencesResponse> {
  const res = await fetch(`${API_URL}/api/user/preferences`, {
    headers: { Authorization: `Bearer ${userToken}` },
  });
  await throwIfNotOk(res, "Failed to fetch preferences");
  return (await res.json()) as UserPreferencesResponse;
}

export async function updatePreferences(
  userToken: string,
  updates: {
    timezone?: string;
    catchUpDepth?: CatchUpDepth;
    preferences?: Record<string, unknown>;
  },
): Promise<void> {
  const res = await fetch(`${API_URL}/api/user/preferences`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify(updates),
  });
  await throwIfNotOk(res, "Failed to update preferences");
}

export async function logout(userToken: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${userToken}` },
  });
  // Ignore auth errors — the session may already be expired
  if (res.ok || res.status === 401) return;
  await throwIfNotOk(res, "Logout failed");
}
