export interface AlphaSessionData {
  userId: string;
  userName?: string;
  sessionId: string;
}

export function isNewUser(user: { name: string } | null): boolean {
  return !user?.name || user.name.trim() === "";
}
