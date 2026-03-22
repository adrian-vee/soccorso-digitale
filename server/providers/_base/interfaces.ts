/**
 * Base interfaces for all API providers.
 * Every provider category (geo, weather, traffic, etc.) implements these.
 */

/** Result wrapper — every provider call returns this */
export interface ProviderResult<T> {
  readonly data: T | null;
  readonly source: string;       // e.g. "nominatim", "google-maps", "cache"
  readonly cached: boolean;
  readonly latencyMs: number;
  readonly error?: string;
}

/** Health status of a provider */
export type ProviderHealth = "healthy" | "degraded" | "down";

/** Provider configuration */
export interface ProviderConfig {
  readonly name: string;
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly timeout: number;          // ms
  readonly maxRetries: number;
  readonly rateLimitPerSecond: number;
  readonly rateLimitPerDay: number;
  readonly priority: number;         // lower = preferred
}

/** Base interface for any external API provider */
export interface IProvider {
  readonly name: string;
  readonly config: ProviderConfig;
  getHealth(): ProviderHealth;
  isAvailable(): boolean;
}

/** Provider manager — orchestrates primary + fallback providers */
export interface IProviderManager<T extends IProvider> {
  readonly primary: T;
  readonly fallbacks: readonly T[];
  getActiveProvider(): T;
  getHealth(): Record<string, ProviderHealth>;
}

/** Cache entry shape */
export interface CacheEntry<T> {
  readonly key: string;
  readonly data: T;
  readonly createdAt: number;      // epoch ms
  readonly expiresAt: number;      // epoch ms
  readonly source: string;
  readonly hitCount: number;
}

/** Cache TTL presets (in seconds) */
export const CACHE_TTL = {
  GEOCODING: 30 * 24 * 3600,       // 30 days
  HOLIDAYS: 365 * 24 * 3600,       // 1 year
  SSN_STRUCTURES: 7 * 24 * 3600,   // 7 days
  WEATHER: 30 * 60,                 // 30 minutes
  TRAFFIC: 5 * 60,                  // 5 minutes
  EMERGENCY_ALERTS: 5 * 60,        // 5 minutes
  ISOCHRONES: 24 * 3600,           // 1 day
  COMUNI_CAP: 90 * 24 * 3600,      // 90 days
} as const;

/** Rate limit tracking per tenant */
export interface TenantQuota {
  readonly organizationId: string;
  readonly provider: string;
  readonly requestsToday: number;
  readonly requestsThisMinute: number;
  readonly dailyLimit: number;
  readonly perMinuteLimit: number;
  readonly lastReset: number;
}
