/**
 * Nager.Date Holiday Provider
 *
 * Free API for Italian national holidays.
 * Use case: shift planning, scheduling, overtime calculation.
 * Cache: 1 year (holidays are fixed per year).
 */

import { IProvider, ProviderConfig, ProviderHealth } from "../_base";

export interface Holiday {
  readonly date: string;         // YYYY-MM-DD
  readonly localName: string;    // Italian name
  readonly name: string;         // English name
  readonly fixed: boolean;       // true if same date every year
  readonly global: boolean;      // true if national
  readonly types: readonly string[];
}

export class NagerDateProvider implements IProvider {
  readonly name = "nager-date";
  readonly config: ProviderConfig = {
    name: "nager-date",
    baseUrl: "https://date.nager.at/api/v3",
    timeout: 8_000,
    maxRetries: 2,
    rateLimitPerSecond: 5,
    rateLimitPerDay: 1_000,
    priority: 1,
  };

  private health: ProviderHealth = "healthy";

  getHealth(): ProviderHealth { return this.health; }
  isAvailable(): boolean { return this.health !== "down"; }

  /** Get all public holidays for a year */
  async getHolidays(year: number, countryCode = "IT"): Promise<Holiday[]> {
    const response = await fetch(
      `${this.config.baseUrl}/PublicHolidays/${year}/${countryCode}`,
      { signal: AbortSignal.timeout(this.config.timeout) },
    );

    if (!response.ok) {
      this.health = "degraded";
      throw new Error(`Nager.Date failed: ${response.status}`);
    }

    this.health = "healthy";
    const data = await response.json() as NagerHoliday[];

    return data.map(h => ({
      date: h.date,
      localName: h.localName,
      name: h.name,
      fixed: h.fixed,
      global: h.global,
      types: h.types,
    }));
  }

  /** Check if a specific date is a holiday */
  async isHoliday(date: string, countryCode = "IT"): Promise<Holiday | null> {
    const year = parseInt(date.substring(0, 4));
    const holidays = await this.getHolidays(year, countryCode);
    return holidays.find(h => h.date === date) ?? null;
  }
}

interface NagerHoliday {
  date: string;
  localName: string;
  name: string;
  fixed: boolean;
  global: boolean;
  types: string[];
  countryCode: string;
}
