/**
 * Brevo (ex Sendinblue) — Transactional SMS Provider
 *
 * Free tier: 300 emails/day + limited SMS (pay-as-you-go for SMS).
 * API key required: BREVO_API_KEY env var.
 * Use cases: OTP codes, shift reminders, emergency notifications.
 *
 * Docs: https://developers.brevo.com/reference/sendtransacsms
 */

import { IProvider, ProviderConfig, ProviderHealth } from "../_base";

/** Result of an SMS send operation */
export interface SmsSendResult {
  readonly messageId: string;
  readonly to: string;
  readonly status: "sent" | "failed";
  readonly creditsUsed: number;
}

/** Result of checking remaining SMS credits */
export interface SmsCreditsResult {
  readonly remainingCredits: number;
  readonly currency: string;
}

export class BrevoSmsProvider implements IProvider {
  readonly name = "brevo-sms";
  readonly config: ProviderConfig = {
    name: "brevo-sms",
    baseUrl: "https://api.brevo.com/v3",
    timeout: 10_000,
    maxRetries: 2,
    rateLimitPerSecond: 10,
    rateLimitPerDay: 1_000,
    priority: 1,
  };

  private health: ProviderHealth = "healthy";

  getHealth(): ProviderHealth { return this.health; }
  isAvailable(): boolean {
    return this.health !== "down" && !!this.getApiKey();
  }

  private getApiKey(): string | undefined {
    return process.env.BREVO_API_KEY;
  }

  /**
   * Send a transactional SMS via Brevo API.
   *
   * @param to     Recipient phone in E.164 format (e.g. "+393401234567")
   * @param content SMS body text (max 160 chars for 1 segment)
   * @param sender Sender name (max 11 alphanumeric chars, or phone number)
   */
  async sendSms(
    to: string,
    content: string,
    sender: string = "SoccDigit",
  ): Promise<SmsSendResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("BREVO_API_KEY not configured");
    }

    // Validate E.164 format
    if (!/^\+\d{7,15}$/.test(to)) {
      throw new Error(`Invalid phone number format: ${to}. Must be E.164 (e.g. +393401234567)`);
    }

    // Validate sender (max 11 alphanumeric or a phone number)
    if (!/^(\+?\d{1,15}|[a-zA-Z0-9]{1,11})$/.test(sender)) {
      throw new Error(`Invalid sender: ${sender}. Max 11 alphanumeric chars or phone number.`);
    }

    const response = await fetch(`${this.config.baseUrl}/transactionalSMS/sms`, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        type: "transactional",
        unicodeEnabled: true,
        sender,
        recipient: to,
        content,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      this.health = response.status >= 500 ? "down" : "degraded";
      const errorBody = await response.text();
      throw new Error(`Brevo SMS API error ${response.status}: ${errorBody}`);
    }

    this.health = "healthy";
    const data = await response.json() as { reference: string; messageId: number; smsCount: number };

    return {
      messageId: String(data.messageId),
      to,
      status: "sent",
      creditsUsed: data.smsCount ?? 1,
    };
  }

  /** Get remaining SMS credits on the Brevo account */
  async getCredits(): Promise<SmsCreditsResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("BREVO_API_KEY not configured");
    }

    const response = await fetch(`${this.config.baseUrl}/account`, {
      headers: {
        "api-key": apiKey,
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      this.health = "degraded";
      throw new Error(`Brevo account API error: ${response.status}`);
    }

    this.health = "healthy";
    const data = await response.json() as BrevoAccountResponse;

    const smsPlan = data.plan?.find(p => p.type === "sms");
    return {
      remainingCredits: smsPlan?.credits ?? 0,
      currency: "EUR",
    };
  }
}

interface BrevoAccountResponse {
  plan?: Array<{
    type: string;
    credits: number;
    creditsType: string;
  }>;
}
