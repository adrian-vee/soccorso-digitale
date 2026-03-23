/**
 * Notifications Provider Manager
 *
 * Aggregates notification channels:
 * - SMS via Brevo (transactional)
 */

import { ProviderCache } from "../_base";
import { BrevoSmsProvider, type SmsSendResult, type SmsCreditsResult } from "./brevo-sms.provider";

class NotificationsProviderManager {
  readonly smsProvider: BrevoSmsProvider;

  constructor() {
    this.smsProvider = new BrevoSmsProvider();
  }

  /** Send a transactional SMS */
  async sendSms(to: string, content: string, sender?: string): Promise<SmsSendResult> {
    return this.smsProvider.sendSms(to, content, sender);
  }

  /** Get remaining SMS credits */
  async getSmsCredits(): Promise<SmsCreditsResult> {
    return this.smsProvider.getCredits();
  }

  getHealth() {
    return {
      brevoSms: this.smsProvider.getHealth(),
      configured: this.smsProvider.isAvailable(),
    };
  }
}

let instance: NotificationsProviderManager | null = null;
export function getNotificationsProvider(): NotificationsProviderManager {
  if (!instance) instance = new NotificationsProviderManager();
  return instance;
}

export { type SmsSendResult, type SmsCreditsResult } from "./brevo-sms.provider";
