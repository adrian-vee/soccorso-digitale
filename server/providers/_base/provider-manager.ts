/**
 * Generic Provider Manager — orchestrates primary + fallback providers.
 *
 * Flow:
 * 1. Check cache → return if hit
 * 2. Check rate limit → fail if exceeded
 * 3. Check circuit breaker → skip provider if open
 * 4. Call primary provider
 * 5. On failure → try fallback providers in priority order
 * 6. Cache successful result
 * 7. Return ProviderResult with metadata
 */

import { IProvider, ProviderConfig, ProviderHealth, ProviderResult } from "./interfaces";
import { ProviderCache } from "./cache";
import { CircuitBreaker } from "./circuit-breaker";
import { TenantRateLimiter, RateLimitConfig } from "./rate-limiter";

export interface ProviderManagerConfig {
  readonly cacheTtlSeconds: number;
  readonly rateLimits: RateLimitConfig;
}

export abstract class BaseProviderManager<TProvider extends IProvider> {
  readonly primary: TProvider;
  readonly fallbacks: readonly TProvider[];
  protected readonly cache: ProviderCache;
  private readonly breakers: Map<string, CircuitBreaker>;
  private readonly rateLimiters: Map<string, TenantRateLimiter>;
  private readonly category: string;

  constructor(
    category: string,
    primary: TProvider,
    fallbacks: TProvider[],
    config: ProviderManagerConfig,
  ) {
    this.category = category;
    this.primary = primary;
    this.fallbacks = fallbacks;
    this.cache = new ProviderCache(category, config.cacheTtlSeconds);

    this.breakers = new Map();
    this.rateLimiters = new Map();

    // Initialize breakers and rate limiters for all providers
    const allProviders = [primary, ...fallbacks];
    for (const provider of allProviders) {
      this.breakers.set(
        provider.name,
        new CircuitBreaker(provider.name)
      );
      this.rateLimiters.set(
        provider.name,
        new TenantRateLimiter(provider.name, config.rateLimits)
      );
    }
  }

  /** Execute a provider call with cache, circuit breaker, and fallback */
  protected async executeWithFallback<T>(
    cacheKey: string,
    organizationId: string,
    callFn: (provider: TProvider) => Promise<T>,
    cacheTtlOverride?: number,
  ): Promise<ProviderResult<T>> {
    const start = Date.now();

    // 1. Check cache
    const cached = this.cache.get<T>(cacheKey);
    if (cached) {
      return {
        data: cached.data,
        source: `cache:${cached.source}`,
        cached: true,
        latencyMs: Date.now() - start,
      };
    }

    // 2. Try providers in priority order
    const providers = [this.primary, ...this.fallbacks];
    const errors: string[] = [];

    for (const provider of providers) {
      const breaker = this.breakers.get(provider.name)!;
      const limiter = this.rateLimiters.get(provider.name)!;

      // Check circuit breaker
      if (!breaker.canRequest()) {
        errors.push(`${provider.name}: circuit open`);
        continue;
      }

      // Check rate limit
      const rateCheck = limiter.canRequest(organizationId);
      if (!rateCheck.allowed) {
        errors.push(`${provider.name}: rate limited (retry in ${rateCheck.retryAfterMs}ms)`);
        continue;
      }

      try {
        limiter.recordRequest(organizationId);
        const data = await callFn(provider);
        breaker.recordSuccess();

        // Cache the result
        this.cache.set(cacheKey, data, provider.name, cacheTtlOverride);

        return {
          data,
          source: provider.name,
          cached: false,
          latencyMs: Date.now() - start,
        };
      } catch (err) {
        breaker.recordFailure();
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${provider.name}: ${msg}`);
      }
    }

    // All providers failed
    return {
      data: null,
      source: "none",
      cached: false,
      latencyMs: Date.now() - start,
      error: `All providers failed: ${errors.join("; ")}`,
    };
  }

  /** Get health status of all providers */
  getHealth(): Record<string, { health: ProviderHealth; circuit: string; recentFailures: number }> {
    const result: Record<string, { health: ProviderHealth; circuit: string; recentFailures: number }> = {};

    const allProviders = [this.primary, ...this.fallbacks];
    for (const provider of allProviders) {
      const breaker = this.breakers.get(provider.name)!;
      const stats = breaker.stats();
      result[provider.name] = {
        health: provider.getHealth(),
        circuit: stats.state,
        recentFailures: stats.recentFailures,
      };
    }

    return result;
  }

  /** Get cache stats */
  getCacheStats() {
    return this.cache.stats();
  }

  /** Get active provider (first available) */
  getActiveProvider(): TProvider {
    const breaker = this.breakers.get(this.primary.name)!;
    if (breaker.canRequest()) {
      return this.primary;
    }
    for (const fallback of this.fallbacks) {
      const fb = this.breakers.get(fallback.name)!;
      if (fb.canRequest()) {
        return fallback;
      }
    }
    return this.primary; // default even if broken
  }

  /** Force reset a provider's circuit breaker (admin) */
  resetCircuit(providerName: string): boolean {
    const breaker = this.breakers.get(providerName);
    if (breaker) {
      breaker.reset();
      return true;
    }
    return false;
  }

  /** Invalidate cache entries matching a prefix */
  invalidateCache(prefix?: string): number {
    if (prefix) {
      return this.cache.invalidatePrefix(prefix);
    }
    this.cache.clear();
    return -1; // cleared all
  }
}
