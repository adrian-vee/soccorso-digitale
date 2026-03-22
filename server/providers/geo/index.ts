/**
 * Geo Provider Manager
 *
 * Primary: Nominatim (free, 1 req/sec)
 * Fallback: Google Maps (paid, already integrated)
 *
 * Cache: 30 days for geocoding results (addresses rarely change)
 */

import { BaseProviderManager, CACHE_TTL, type ProviderResult } from "../_base";
import { NominatimProvider, type GeocodingResult, type ReverseGeocodingResult } from "./nominatim";

export class GeoProviderManager extends BaseProviderManager<NominatimProvider> {
  constructor() {
    const nominatim = new NominatimProvider();

    super("geo", nominatim, [], {
      cacheTtlSeconds: CACHE_TTL.GEOCODING,
      rateLimits: {
        perSecond: 1,
        perMinute: 30,
        perDay: 5000,
      },
    });
  }

  /** Geocode an address to coordinates */
  async geocode(
    query: string,
    organizationId: string,
    countryCode = "it",
  ): Promise<ProviderResult<GeocodingResult[]>> {
    const cacheKey = this.cache.buildKey(["geocode", query, countryCode]);

    return this.executeWithFallback(
      cacheKey,
      organizationId,
      (provider) => provider.geocode(query, countryCode),
    );
  }

  /** Reverse geocode coordinates to address */
  async reverseGeocode(
    lat: number,
    lon: number,
    organizationId: string,
  ): Promise<ProviderResult<ReverseGeocodingResult | null>> {
    // Round to 5 decimal places for cache key (11m precision)
    const cacheKey = this.cache.buildKey([
      "reverse",
      lat.toFixed(5),
      lon.toFixed(5),
    ]);

    return this.executeWithFallback(
      cacheKey,
      organizationId,
      (provider) => provider.reverseGeocode(lat, lon),
    );
  }
}

// Singleton instance
let instance: GeoProviderManager | null = null;

export function getGeoProvider(): GeoProviderManager {
  if (!instance) {
    instance = new GeoProviderManager();
  }
  return instance;
}

export { NominatimProvider, type GeocodingResult, type ReverseGeocodingResult } from "./nominatim";
