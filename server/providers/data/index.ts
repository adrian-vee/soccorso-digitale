/**
 * Data Provider Manager
 *
 * Aggregates data-oriented providers: holidays, emergency alerts, etc.
 * Each has its own cache TTL and rate limits.
 */

import { ProviderCache, CACHE_TTL, type ProviderResult } from "../_base";
import { NagerDateProvider, type Holiday } from "./holidays";
import { ProtezioneCivileProvider, type EmergencyAlert } from "./protezione-civile";

class DataProviderManager {
  readonly holidays: NagerDateProvider;
  readonly protezioneCivile: ProtezioneCivileProvider;
  private readonly holidayCache: ProviderCache;
  private readonly alertCache: ProviderCache;

  constructor() {
    this.holidays = new NagerDateProvider();
    this.protezioneCivile = new ProtezioneCivileProvider();
    this.holidayCache = new ProviderCache("holidays", CACHE_TTL.HOLIDAYS);
    this.alertCache = new ProviderCache("alerts", CACHE_TTL.EMERGENCY_ALERTS);
  }

  /** Get holidays for a year (cached for 1 year) */
  async getHolidays(year: number): Promise<ProviderResult<Holiday[]>> {
    const start = Date.now();
    const cacheKey = this.holidayCache.buildKey(["it", year.toString()]);

    const cached = this.holidayCache.get<Holiday[]>(cacheKey);
    if (cached) {
      return { data: cached.data, source: "cache:nager-date", cached: true, latencyMs: Date.now() - start };
    }

    try {
      const data = await this.holidays.getHolidays(year);
      this.holidayCache.set(cacheKey, data, "nager-date");
      return { data, source: "nager-date", cached: false, latencyMs: Date.now() - start };
    } catch (err) {
      return { data: null, source: "none", cached: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }

  /** Check if a date is a holiday */
  async isHoliday(date: string): Promise<ProviderResult<Holiday | null>> {
    const start = Date.now();
    const year = parseInt(date.substring(0, 4));
    const result = await this.getHolidays(year);

    if (!result.data) {
      return { data: null, source: result.source, cached: result.cached, latencyMs: Date.now() - start, error: result.error };
    }

    const holiday = result.data.find(h => h.date === date) ?? null;
    return { data: holiday, source: result.source, cached: result.cached, latencyMs: Date.now() - start };
  }

  /** Get emergency alerts for a region (cached 5 min) */
  async getAlerts(region?: string): Promise<ProviderResult<EmergencyAlert[]>> {
    const start = Date.now();
    const cacheKey = this.alertCache.buildKey(["alerts", region ?? "all"]);

    const cached = this.alertCache.get<EmergencyAlert[]>(cacheKey);
    if (cached) {
      return { data: cached.data, source: "cache:protezione-civile", cached: true, latencyMs: Date.now() - start };
    }

    try {
      const data = region
        ? await this.protezioneCivile.getAlertsForRegion(region)
        : await this.protezioneCivile.getCurrentAlerts();

      this.alertCache.set(cacheKey, data, "protezione-civile");
      return { data, source: "protezione-civile", cached: false, latencyMs: Date.now() - start };
    } catch (err) {
      return { data: null, source: "none", cached: false, latencyMs: Date.now() - start, error: String(err) };
    }
  }

  /** Check for severe alerts in a region */
  async hasSevereAlerts(region: string): Promise<boolean> {
    const result = await this.getAlerts(region);
    if (!result.data) return false;
    return result.data.some(a => a.severity === "orange" || a.severity === "red");
  }

  getHealth() {
    return {
      holidays: this.holidays.getHealth(),
      protezioneCivile: this.protezioneCivile.getHealth(),
    };
  }
}

let instance: DataProviderManager | null = null;
export function getDataProvider(): DataProviderManager {
  if (!instance) instance = new DataProviderManager();
  return instance;
}

export { type Holiday } from "./holidays";
export { type EmergencyAlert } from "./protezione-civile";
