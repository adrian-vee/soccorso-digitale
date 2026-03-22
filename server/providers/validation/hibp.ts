/**
 * Have I Been Pwned — Password Breach Check
 *
 * Free k-Anonymity API (no API key for password check).
 * Checks if a password appears in known data breaches.
 * Use case: password strength validation at registration/change.
 *
 * Privacy: Only sends first 5 chars of SHA-1 hash (k-Anonymity model).
 */

import { createHash } from "crypto";
import { IProvider, ProviderConfig, ProviderHealth } from "../_base";

export interface PasswordBreachResult {
  readonly breached: boolean;
  readonly occurrences: number;
  readonly message: string;
}

export class HibpProvider implements IProvider {
  readonly name = "hibp";
  readonly config: ProviderConfig = {
    name: "hibp",
    baseUrl: "https://api.pwnedpasswords.com",
    timeout: 5_000,
    maxRetries: 2,
    rateLimitPerSecond: 5,
    rateLimitPerDay: 5_000,
    priority: 1,
  };

  private health: ProviderHealth = "healthy";

  getHealth(): ProviderHealth { return this.health; }
  isAvailable(): boolean { return this.health !== "down"; }

  /** Check if a password has been found in data breaches */
  async checkPassword(password: string): Promise<PasswordBreachResult> {
    // SHA-1 hash the password
    const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
    const prefix = sha1.substring(0, 5);
    const suffix = sha1.substring(5);

    const response = await fetch(`${this.config.baseUrl}/range/${prefix}`, {
      headers: {
        "User-Agent": "SoccorsoDigitale-PasswordCheck",
        "Add-Padding": "true",
      },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      this.health = "degraded";
      throw new Error(`HIBP failed: ${response.status}`);
    }

    this.health = "healthy";
    const text = await response.text();

    // Parse response: each line is "SUFFIX:COUNT"
    const lines = text.split("\n");
    for (const line of lines) {
      const [hashSuffix, countStr] = line.split(":");
      if (hashSuffix?.trim() === suffix) {
        const count = parseInt(countStr?.trim() ?? "0");
        if (count > 0) {
          return {
            breached: true,
            occurrences: count,
            message: `Questa password è stata trovata in ${count.toLocaleString("it-IT")} violazioni di dati. Scegli una password diversa.`,
          };
        }
      }
    }

    return {
      breached: false,
      occurrences: 0,
      message: "Password non trovata in violazioni di dati note.",
    };
  }
}
