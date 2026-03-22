/**
 * Per-tenant API rate limiter.
 *
 * Tracks usage per organization per provider to:
 * - Respect external API quotas (e.g., Nominatim 1 req/sec)
 * - Ensure fair multi-tenant usage
 * - Prevent a single tenant from exhausting shared quotas
 */

import { TenantQuota } from "./interfaces";

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

export interface RateLimitConfig {
  readonly perSecond: number;
  readonly perMinute: number;
  readonly perDay: number;
}

export class TenantRateLimiter {
  // Key format: "orgId:provider:window"
  private readonly windows = new Map<string, RateLimitWindow>();
  private readonly config: RateLimitConfig;
  private readonly provider: string;

  constructor(provider: string, config: RateLimitConfig) {
    this.provider = provider;
    this.config = config;
  }

  /** Check if a request is allowed for this tenant */
  canRequest(organizationId: string): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();

    // Check per-second limit
    const secKey = `${organizationId}:${this.provider}:sec`;
    const secWindow = this.getOrCreateWindow(secKey, now, 1000);
    if (secWindow.count >= this.config.perSecond) {
      return { allowed: false, retryAfterMs: secWindow.resetAt - now };
    }

    // Check per-minute limit
    const minKey = `${organizationId}:${this.provider}:min`;
    const minWindow = this.getOrCreateWindow(minKey, now, 60_000);
    if (minWindow.count >= this.config.perMinute) {
      return { allowed: false, retryAfterMs: minWindow.resetAt - now };
    }

    // Check per-day limit
    const dayKey = `${organizationId}:${this.provider}:day`;
    const dayWindow = this.getOrCreateWindow(dayKey, now, 86_400_000);
    if (dayWindow.count >= this.config.perDay) {
      return { allowed: false, retryAfterMs: dayWindow.resetAt - now };
    }

    return { allowed: true };
  }

  /** Record a request for this tenant */
  recordRequest(organizationId: string): void {
    const now = Date.now();

    this.incrementWindow(`${organizationId}:${this.provider}:sec`, now, 1000);
    this.incrementWindow(`${organizationId}:${this.provider}:min`, now, 60_000);
    this.incrementWindow(`${organizationId}:${this.provider}:day`, now, 86_400_000);
  }

  /** Get usage stats for a tenant */
  getUsage(organizationId: string): TenantQuota {
    const now = Date.now();

    const minWindow = this.getOrCreateWindow(
      `${organizationId}:${this.provider}:min`, now, 60_000
    );
    const dayWindow = this.getOrCreateWindow(
      `${organizationId}:${this.provider}:day`, now, 86_400_000
    );

    return {
      organizationId,
      provider: this.provider,
      requestsToday: dayWindow.count,
      requestsThisMinute: minWindow.count,
      dailyLimit: this.config.perDay,
      perMinuteLimit: this.config.perMinute,
      lastReset: dayWindow.resetAt - 86_400_000,
    };
  }

  /** Cleanup expired windows (call periodically) */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [key, window] of this.windows) {
      if (now > window.resetAt) {
        this.windows.delete(key);
        removed++;
      }
    }
    return removed;
  }

  private getOrCreateWindow(key: string, now: number, windowMs: number): RateLimitWindow {
    const existing = this.windows.get(key);
    if (existing && now < existing.resetAt) {
      return existing;
    }
    const window: RateLimitWindow = { count: 0, resetAt: now + windowMs };
    this.windows.set(key, window);
    return window;
  }

  private incrementWindow(key: string, now: number, windowMs: number): void {
    const window = this.getOrCreateWindow(key, now, windowMs);
    // Mutating here is intentional — rate limiter counters are transient state
    window.count++;
  }
}
