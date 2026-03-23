/**
 * Open-Meteo Weather Provider
 *
 * Free, no API key, no rate limit (fair use ~10K/day).
 * Provides: current weather, hourly forecast, daily forecast.
 * Use case: ETA calculator weather factor, trip planning.
 */

import { IProvider, ProviderConfig, ProviderHealth } from "../_base";

export interface WeatherData {
  readonly temperature: number;      // °C
  readonly feelsLike: number;        // °C
  readonly humidity: number;         // %
  readonly windSpeed: number;        // km/h
  readonly precipitation: number;    // mm
  readonly weatherCode: number;      // WMO code
  readonly weatherDescription: string;
  readonly visibility: number;       // km
  readonly isAdverse: boolean;       // fog, heavy rain, snow, ice
}

export interface DailyForecast {
  readonly time: string[];
  readonly temperature_2m_max: number[];
  readonly temperature_2m_min: number[];
  readonly weather_code: number[];
  readonly weathercode: number[]; // alias for weather_code (frontend compat)
  readonly precipitation_sum: number[];
}

export interface WeatherForecast {
  readonly current: WeatherData;
  readonly hourly: readonly HourlyForecast[];
  readonly daily: DailyForecast;
}

export interface HourlyForecast {
  readonly time: string;             // ISO 8601
  readonly temperature: number;
  readonly precipitation: number;
  readonly weatherCode: number;
  readonly weatherDescription: string;
  readonly windSpeed: number;
  readonly visibility: number;
}

/** WMO weather codes → descriptions + adverse flag */
const WMO_CODES: Record<number, { description: string; adverse: boolean }> = {
  0: { description: "Sereno", adverse: false },
  1: { description: "Prevalentemente sereno", adverse: false },
  2: { description: "Parzialmente nuvoloso", adverse: false },
  3: { description: "Coperto", adverse: false },
  45: { description: "Nebbia", adverse: true },
  48: { description: "Nebbia con brina", adverse: true },
  51: { description: "Pioggerella leggera", adverse: false },
  53: { description: "Pioggerella moderata", adverse: false },
  55: { description: "Pioggerella intensa", adverse: true },
  61: { description: "Pioggia leggera", adverse: false },
  63: { description: "Pioggia moderata", adverse: true },
  65: { description: "Pioggia forte", adverse: true },
  66: { description: "Pioggia gelata leggera", adverse: true },
  67: { description: "Pioggia gelata forte", adverse: true },
  71: { description: "Neve leggera", adverse: true },
  73: { description: "Neve moderata", adverse: true },
  75: { description: "Neve forte", adverse: true },
  77: { description: "Granuli di neve", adverse: true },
  80: { description: "Rovesci leggeri", adverse: false },
  81: { description: "Rovesci moderati", adverse: true },
  82: { description: "Rovesci violenti", adverse: true },
  85: { description: "Neve a tratti leggera", adverse: true },
  86: { description: "Neve a tratti forte", adverse: true },
  95: { description: "Temporale", adverse: true },
  96: { description: "Temporale con grandine leggera", adverse: true },
  99: { description: "Temporale con grandine forte", adverse: true },
};

function decodeWMO(code: number): { description: string; adverse: boolean } {
  return WMO_CODES[code] ?? { description: `Codice ${code}`, adverse: false };
}

export class OpenMeteoProvider implements IProvider {
  readonly name = "open-meteo";
  readonly config: ProviderConfig = {
    name: "open-meteo",
    baseUrl: "https://api.open-meteo.com/v1",
    timeout: 8_000,
    maxRetries: 2,
    rateLimitPerSecond: 10,
    rateLimitPerDay: 10_000,
    priority: 1,
  };

  private health: ProviderHealth = "healthy";

  getHealth(): ProviderHealth { return this.health; }
  isAvailable(): boolean { return this.health !== "down"; }

  /** Get current weather + 24h hourly forecast */
  async getWeather(lat: number, lon: number): Promise<WeatherForecast> {
    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,visibility",
      hourly: "temperature_2m,precipitation,weather_code,wind_speed_10m,visibility",
      daily: "temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum",
      forecast_hours: "24",
      forecast_days: "7",
      timezone: "Europe/Rome",
    });

    const response = await fetch(`${this.config.baseUrl}/forecast?${params}`, {
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      this.health = "degraded";
      throw new Error(`Open-Meteo failed: ${response.status}`);
    }

    this.health = "healthy";
    const raw = await response.json() as OpenMeteoResponse;

    const currentWmo = decodeWMO(raw.current.weather_code);
    const current: WeatherData = {
      temperature: raw.current.temperature_2m,
      feelsLike: raw.current.apparent_temperature,
      humidity: raw.current.relative_humidity_2m,
      windSpeed: raw.current.wind_speed_10m,
      precipitation: raw.current.precipitation,
      weatherCode: raw.current.weather_code,
      weatherDescription: currentWmo.description,
      visibility: (raw.current.visibility ?? 10000) / 1000, // m → km
      isAdverse: currentWmo.adverse,
    };

    const hourly: HourlyForecast[] = raw.hourly.time.map((time, i) => {
      const wmo = decodeWMO(raw.hourly.weather_code[i]);
      return {
        time,
        temperature: raw.hourly.temperature_2m[i],
        precipitation: raw.hourly.precipitation[i],
        weatherCode: raw.hourly.weather_code[i],
        weatherDescription: wmo.description,
        windSpeed: raw.hourly.wind_speed_10m[i],
        visibility: (raw.hourly.visibility?.[i] ?? 10000) / 1000,
      };
    });

    const dailyWithAlias: DailyForecast = {
      ...raw.daily,
      weathercode: raw.daily.weather_code,
    };

    return { current, hourly, daily: dailyWithAlias };
  }

  /** Calculate weather impact factor for ETA (0-1, higher = worse) */
  async getWeatherImpact(lat: number, lon: number): Promise<number> {
    const forecast = await this.getWeather(lat, lon);
    const w = forecast.current;

    let impact = 0;

    // Precipitation impact
    if (w.precipitation > 10) impact += 0.3;
    else if (w.precipitation > 2) impact += 0.15;
    else if (w.precipitation > 0) impact += 0.05;

    // Visibility impact
    if (w.visibility < 0.5) impact += 0.4;
    else if (w.visibility < 1) impact += 0.2;
    else if (w.visibility < 5) impact += 0.1;

    // Wind impact
    if (w.windSpeed > 60) impact += 0.2;
    else if (w.windSpeed > 30) impact += 0.1;

    // Snow/ice
    if ([71, 73, 75, 77, 85, 86, 66, 67].includes(w.weatherCode)) {
      impact += 0.3;
    }

    return Math.min(1, impact);
  }
}

// Open-Meteo API response shape
interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    visibility?: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    visibility?: number[];
  };
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    precipitation_sum: number[];
  };
}
