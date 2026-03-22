/**
 * Weather Provider Manager
 *
 * Primary: Open-Meteo (free, no key)
 * Cache: 30 minutes (weather changes frequently)
 */

import { BaseProviderManager, CACHE_TTL, type ProviderResult } from "../_base";
import { OpenMeteoProvider, type WeatherForecast } from "./open-meteo";

export class WeatherProviderManager extends BaseProviderManager<OpenMeteoProvider> {
  constructor() {
    super("weather", new OpenMeteoProvider(), [], {
      cacheTtlSeconds: CACHE_TTL.WEATHER,
      rateLimits: { perSecond: 5, perMinute: 100, perDay: 5000 },
    });
  }

  async getWeather(
    lat: number,
    lon: number,
    organizationId: string,
  ): Promise<ProviderResult<WeatherForecast>> {
    const cacheKey = this.cache.buildKey([
      "forecast",
      lat.toFixed(2),
      lon.toFixed(2),
    ]);
    return this.executeWithFallback(cacheKey, organizationId, (p) => p.getWeather(lat, lon));
  }

  async getWeatherImpact(
    lat: number,
    lon: number,
    organizationId: string,
  ): Promise<ProviderResult<number>> {
    const cacheKey = this.cache.buildKey([
      "impact",
      lat.toFixed(2),
      lon.toFixed(2),
    ]);
    return this.executeWithFallback(cacheKey, organizationId, (p) => p.getWeatherImpact(lat, lon));
  }
}

let instance: WeatherProviderManager | null = null;
export function getWeatherProvider(): WeatherProviderManager {
  if (!instance) instance = new WeatherProviderManager();
  return instance;
}

export { OpenMeteoProvider, type WeatherForecast, type WeatherData, type HourlyForecast } from "./open-meteo";
