/**
 * Validation Provider Manager
 *
 * Aggregates all validation providers:
 * - Codice Fiscale (local, no API)
 * - P.IVA / VAT (VATComply)
 * - Password breach check (HIBP)
 */

import { ProviderCache, CACHE_TTL } from "../_base";
import { validateCodiceFiscale, extractBirthInfo, type CodiceFiscaleValidation } from "./codice-fiscale";
import { VatComplyProvider, type VatValidationResult } from "./vat-comply";
import { HibpProvider, type PasswordBreachResult } from "./hibp";

class ValidationProviderManager {
  readonly vatProvider: VatComplyProvider;
  readonly hibpProvider: HibpProvider;
  private readonly vatCache: ProviderCache;

  constructor() {
    this.vatProvider = new VatComplyProvider();
    this.hibpProvider = new HibpProvider();
    this.vatCache = new ProviderCache("vat", 7 * 24 * 3600); // 7 days cache
  }

  /** Validate Codice Fiscale (local, instant) */
  validateCF(cf: string): CodiceFiscaleValidation {
    return validateCodiceFiscale(cf);
  }

  /** Extract birth info from CF */
  extractCFInfo(cf: string) {
    return extractBirthInfo(cf);
  }

  /** Validate P.IVA via VIES (cached 7 days) */
  async validateVAT(vatNumber: string): Promise<VatValidationResult> {
    const cleaned = vatNumber.replace(/[\s.]/g, "").toUpperCase();
    const cacheKey = this.vatCache.buildKey(["vat", cleaned]);

    const cached = this.vatCache.get<VatValidationResult>(cacheKey);
    if (cached) return cached.data;

    const result = await this.vatProvider.validate(vatNumber);
    this.vatCache.set(cacheKey, result, "vatcomply");
    return result;
  }

  /** Check password against breach databases */
  async checkPassword(password: string): Promise<PasswordBreachResult> {
    // Never cache passwords
    return this.hibpProvider.checkPassword(password);
  }

  getHealth() {
    return {
      codiceFiscale: "healthy" as const, // local, always healthy
      vatComply: this.vatProvider.getHealth(),
      hibp: this.hibpProvider.getHealth(),
    };
  }
}

let instance: ValidationProviderManager | null = null;
export function getValidationProvider(): ValidationProviderManager {
  if (!instance) instance = new ValidationProviderManager();
  return instance;
}

export { validateCodiceFiscale, extractBirthInfo, type CodiceFiscaleValidation } from "./codice-fiscale";
export { type VatValidationResult } from "./vat-comply";
export { type PasswordBreachResult } from "./hibp";
