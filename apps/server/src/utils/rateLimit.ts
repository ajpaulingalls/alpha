export class RateLimiter {
  private attempts = new Map<string, number[]>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    private readonly windowMs: number,
    private readonly maxAttempts: number,
  ) {
    this.cleanupTimer = setInterval(() => this.cleanup(), windowMs);
    // Allow the timer to not block process exit
    this.cleanupTimer.unref();
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const timestamps = this.attempts.get(key) ?? [];
    const recent = timestamps.filter((t) => now - t < this.windowMs);

    if (recent.length >= this.maxAttempts) {
      this.attempts.set(key, recent);
      return false;
    }

    recent.push(now);
    this.attempts.set(key, recent);
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.attempts) {
      const recent = timestamps.filter((t) => now - t < this.windowMs);
      if (recent.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, recent);
      }
    }
  }

  dispose() {
    clearInterval(this.cleanupTimer);
    this.attempts.clear();
  }
}
