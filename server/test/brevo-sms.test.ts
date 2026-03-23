import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrevoSmsProvider } from "../providers/notifications/brevo-sms.provider";

describe("BrevoSmsProvider", () => {
  let provider: BrevoSmsProvider;

  beforeEach(() => {
    provider = new BrevoSmsProvider();
    vi.unstubAllEnvs();
  });

  describe("config", () => {
    it("has correct name and base URL", () => {
      expect(provider.name).toBe("brevo-sms");
      expect(provider.config.baseUrl).toBe("https://api.brevo.com/v3");
    });

    it("has sensible rate limits", () => {
      expect(provider.config.rateLimitPerSecond).toBeGreaterThan(0);
      expect(provider.config.rateLimitPerDay).toBeGreaterThan(0);
      expect(provider.config.timeout).toBeGreaterThanOrEqual(5_000);
    });
  });

  describe("isAvailable", () => {
    it("returns false when BREVO_API_KEY is not set", () => {
      vi.stubEnv("BREVO_API_KEY", "");
      const p = new BrevoSmsProvider();
      expect(p.isAvailable()).toBe(false);
    });

    it("returns true when BREVO_API_KEY is set", () => {
      vi.stubEnv("BREVO_API_KEY", "xkeysib-test-key-123");
      const p = new BrevoSmsProvider();
      expect(p.isAvailable()).toBe(true);
    });
  });

  describe("getHealth", () => {
    it("starts as healthy", () => {
      expect(provider.getHealth()).toBe("healthy");
    });
  });

  describe("sendSms — input validation", () => {
    it("throws on missing API key", async () => {
      vi.stubEnv("BREVO_API_KEY", "");
      const p = new BrevoSmsProvider();
      await expect(p.sendSms("+393401234567", "Test")).rejects.toThrow("BREVO_API_KEY not configured");
    });

    it("throws on invalid phone number (no + prefix)", async () => {
      vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
      const p = new BrevoSmsProvider();
      await expect(p.sendSms("393401234567", "Test")).rejects.toThrow("Invalid phone number format");
    });

    it("throws on invalid phone number (too short)", async () => {
      vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
      const p = new BrevoSmsProvider();
      await expect(p.sendSms("+123", "Test")).rejects.toThrow("Invalid phone number format");
    });

    it("throws on invalid sender (too long)", async () => {
      vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
      const p = new BrevoSmsProvider();
      await expect(p.sendSms("+393401234567", "Test", "TooLongSenderName")).rejects.toThrow("Invalid sender");
    });

    it("accepts valid E.164 phone numbers", async () => {
      vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
      const p = new BrevoSmsProvider();

      // Mock fetch to avoid actual API call
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ reference: "ref1", messageId: 12345, smsCount: 1 }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await p.sendSms("+393401234567", "Turno domani ore 8:00");
      expect(result.status).toBe("sent");
      expect(result.messageId).toBe("12345");
      expect(result.to).toBe("+393401234567");
      expect(result.creditsUsed).toBe(1);

      // Verify the API was called correctly
      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.brevo.com/v3/transactionalSMS/sms");
      expect(options.method).toBe("POST");

      const body = JSON.parse(options.body);
      expect(body.recipient).toBe("+393401234567");
      expect(body.content).toBe("Turno domani ore 8:00");
      expect(body.sender).toBe("SoccDigit");
      expect(body.type).toBe("transactional");
      expect(body.unicodeEnabled).toBe(true);

      vi.unstubAllGlobals();
    });
  });

  describe("sendSms — API error handling", () => {
    it("sets health to degraded on 4xx errors", async () => {
      vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
      const p = new BrevoSmsProvider();

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"message":"Invalid recipient"}'),
      }));

      await expect(p.sendSms("+393401234567", "Test")).rejects.toThrow("Brevo SMS API error 400");
      expect(p.getHealth()).toBe("degraded");

      vi.unstubAllGlobals();
    });

    it("sets health to down on 5xx errors", async () => {
      vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
      const p = new BrevoSmsProvider();

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve("Service Unavailable"),
      }));

      await expect(p.sendSms("+393401234567", "Test")).rejects.toThrow("Brevo SMS API error 503");
      expect(p.getHealth()).toBe("down");

      vi.unstubAllGlobals();
    });

    it("restores health to healthy after successful call", async () => {
      vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
      const p = new BrevoSmsProvider();

      // First: fail
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve("down"),
      }));
      await expect(p.sendSms("+393401234567", "Test")).rejects.toThrow();
      expect(p.getHealth()).toBe("down");

      // Then: succeed
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ reference: "r", messageId: 99, smsCount: 1 }),
      }));
      await p.sendSms("+393401234567", "OK");
      expect(p.getHealth()).toBe("healthy");

      vi.unstubAllGlobals();
    });
  });

  describe("getCredits", () => {
    it("throws on missing API key", async () => {
      vi.stubEnv("BREVO_API_KEY", "");
      const p = new BrevoSmsProvider();
      await expect(p.getCredits()).rejects.toThrow("BREVO_API_KEY not configured");
    });

    it("parses SMS credits from account response", async () => {
      vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
      const p = new BrevoSmsProvider();

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          plan: [
            { type: "email", credits: 300, creditsType: "sendLimit" },
            { type: "sms", credits: 42, creditsType: "sendLimit" },
          ],
        }),
      }));

      const result = await p.getCredits();
      expect(result.remainingCredits).toBe(42);
      expect(result.currency).toBe("EUR");

      vi.unstubAllGlobals();
    });

    it("returns 0 credits when no SMS plan found", async () => {
      vi.stubEnv("BREVO_API_KEY", "xkeysib-test");
      const p = new BrevoSmsProvider();

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plan: [{ type: "email", credits: 300, creditsType: "sendLimit" }] }),
      }));

      const result = await p.getCredits();
      expect(result.remainingCredits).toBe(0);

      vi.unstubAllGlobals();
    });
  });

  describe("NotificationsProviderManager integration", () => {
    it("exports getNotificationsProvider singleton", async () => {
      const { getNotificationsProvider } = await import("../providers/notifications");
      const mgr1 = getNotificationsProvider();
      const mgr2 = getNotificationsProvider();
      expect(mgr1).toBe(mgr2);
    });

    it("manager exposes health check", async () => {
      const { getNotificationsProvider } = await import("../providers/notifications");
      const health = getNotificationsProvider().getHealth();
      expect(health).toHaveProperty("brevoSms");
      expect(health).toHaveProperty("configured");
    });
  });
});
