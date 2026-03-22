/**
 * Nominatim Geocoding Provider (OpenStreetMap)
 *
 * Free, no API key required.
 * Rate limit: 1 request/second (strict).
 * Usage policy: must include User-Agent, no bulk geocoding.
 *
 * Replaces Google Maps geocoding for most use cases.
 * Saves ~€800-1200/year in Google Maps API costs.
 */

import { IProvider, ProviderConfig, ProviderHealth } from "../_base";

export interface GeocodingResult {
  readonly lat: number;
  readonly lon: number;
  readonly displayName: string;
  readonly type: string;
  readonly confidence: number;     // 0-1 based on importance
  readonly city?: string;
  readonly county?: string;
  readonly state?: string;
  readonly country?: string;
  readonly postcode?: string;
}

export interface ReverseGeocodingResult {
  readonly address: string;
  readonly city?: string;
  readonly county?: string;
  readonly state?: string;
  readonly postcode?: string;
  readonly country?: string;
}

export class NominatimProvider implements IProvider {
  readonly name = "nominatim";
  readonly config: ProviderConfig = {
    name: "nominatim",
    baseUrl: "https://nominatim.openstreetmap.org",
    timeout: 10_000,
    maxRetries: 2,
    rateLimitPerSecond: 1,
    rateLimitPerDay: 10_000,
    priority: 1,
  };

  private health: ProviderHealth = "healthy";
  private lastRequestTime = 0;

  getHealth(): ProviderHealth {
    return this.health;
  }

  isAvailable(): boolean {
    return this.health !== "down";
  }

  /** Forward geocoding: address → coordinates */
  async geocode(query: string, countryCode = "it"): Promise<GeocodingResult[]> {
    await this.enforceRateLimit();

    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      countrycodes: countryCode,
      limit: "5",
      "accept-language": "it",
    });

    const response = await fetch(`${this.config.baseUrl}/search?${params}`, {
      headers: {
        "User-Agent": "SoccorsoDigitale/1.0 (info@soccorsodigitale.app)",
      },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      this.health = "degraded";
      throw new Error(`Nominatim geocode failed: ${response.status}`);
    }

    this.health = "healthy";
    const data = await response.json() as NominatimSearchResult[];

    return data.map(item => ({
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      displayName: item.display_name,
      type: item.type,
      confidence: Math.min(1, (item.importance ?? 0.5)),
      city: item.address?.city || item.address?.town || item.address?.village,
      county: item.address?.county,
      state: item.address?.state,
      country: item.address?.country,
      postcode: item.address?.postcode,
    }));
  }

  /** Reverse geocoding: coordinates → address */
  async reverseGeocode(lat: number, lon: number): Promise<ReverseGeocodingResult | null> {
    await this.enforceRateLimit();

    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
      format: "jsonv2",
      addressdetails: "1",
      "accept-language": "it",
    });

    const response = await fetch(`${this.config.baseUrl}/reverse?${params}`, {
      headers: {
        "User-Agent": "SoccorsoDigitale/1.0 (info@soccorsodigitale.app)",
      },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      this.health = "degraded";
      throw new Error(`Nominatim reverse failed: ${response.status}`);
    }

    this.health = "healthy";
    const data = await response.json() as NominatimReverseResult;

    if (!data.address) return null;

    return {
      address: data.display_name,
      city: data.address.city || data.address.town || data.address.village,
      county: data.address.county,
      state: data.address.state,
      postcode: data.address.postcode,
      country: data.address.country,
    };
  }

  /** Enforce 1 req/sec rate limit (Nominatim policy) */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < 1100) { // 1.1s to be safe
      await new Promise(resolve => setTimeout(resolve, 1100 - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}

// Nominatim API response types
interface NominatimSearchResult {
  lat: string;
  lon: string;
  display_name: string;
  type: string;
  importance?: number;
  address?: NominatimAddress;
}

interface NominatimReverseResult {
  display_name: string;
  address?: NominatimAddress;
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
  postcode?: string;
  road?: string;
  house_number?: string;
}
