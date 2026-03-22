/**
 * VATComply Provider — EU VAT Number Validation
 *
 * Free API, no key required.
 * Validates P.IVA against the EU VIES database.
 * Use case: organization/partner onboarding validation.
 */

import { IProvider, ProviderConfig, ProviderHealth } from "../_base";

export interface VatValidationResult {
  readonly valid: boolean;
  readonly vatNumber: string;
  readonly countryCode: string;
  readonly companyName?: string;
  readonly companyAddress?: string;
  readonly requestDate: string;
}

export class VatComplyProvider implements IProvider {
  readonly name = "vatcomply";
  readonly config: ProviderConfig = {
    name: "vatcomply",
    baseUrl: "https://api.vatcomply.com",
    timeout: 10_000,
    maxRetries: 2,
    rateLimitPerSecond: 2,
    rateLimitPerDay: 500,
    priority: 1,
  };

  private health: ProviderHealth = "healthy";

  getHealth(): ProviderHealth { return this.health; }
  isAvailable(): boolean { return this.health !== "down"; }

  /** Validate a VAT number (P.IVA) */
  async validate(vatNumber: string): Promise<VatValidationResult> {
    // Clean input: remove spaces, dots, country prefix
    const cleaned = vatNumber.replace(/[\s.]/g, "").toUpperCase();

    // Extract country code (default IT)
    let countryCode = "IT";
    let number = cleaned;

    if (/^[A-Z]{2}/.test(cleaned)) {
      countryCode = cleaned.substring(0, 2);
      number = cleaned.substring(2);
    }

    const response = await fetch(
      `${this.config.baseUrl}/vat?vat_number=${countryCode}${number}`,
      { signal: AbortSignal.timeout(this.config.timeout) },
    );

    if (!response.ok) {
      this.health = "degraded";
      throw new Error(`VATComply failed: ${response.status}`);
    }

    this.health = "healthy";
    const data = await response.json() as VatComplyResponse;

    return {
      valid: data.valid,
      vatNumber: `${countryCode}${number}`,
      countryCode: data.country_code ?? countryCode,
      companyName: data.name || undefined,
      companyAddress: data.address || undefined,
      requestDate: new Date().toISOString(),
    };
  }
}

interface VatComplyResponse {
  valid: boolean;
  vat_number: string;
  country_code?: string;
  name?: string;
  address?: string;
}
