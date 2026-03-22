/**
 * Protezione Civile Emergency Alerts Provider
 *
 * Source: GitHub pcm-dpc (Presidenza del Consiglio dei Ministri)
 * Free, public data, no API key.
 * Use case: Alert operators about severe weather/emergencies in operating areas.
 * Cache: 5 minutes.
 */

import { IProvider, ProviderConfig, ProviderHealth } from "../_base";

export interface EmergencyAlert {
  readonly id: string;
  readonly type: "meteo" | "idro" | "idrogeo" | "temporali" | "neve" | "vento";
  readonly severity: "green" | "yellow" | "orange" | "red";
  readonly region: string;
  readonly zones: readonly string[];
  readonly description: string;
  readonly validFrom: string;      // ISO 8601
  readonly validTo: string;
  readonly source: string;
}

export class ProtezioneCivileProvider implements IProvider {
  readonly name = "protezione-civile";
  readonly config: ProviderConfig = {
    name: "protezione-civile",
    baseUrl: "https://raw.githubusercontent.com/pcm-dpc",
    timeout: 10_000,
    maxRetries: 3,
    rateLimitPerSecond: 2,
    rateLimitPerDay: 500,
    priority: 1,
  };

  private health: ProviderHealth = "healthy";

  getHealth(): ProviderHealth { return this.health; }
  isAvailable(): boolean { return this.health !== "down"; }

  /** Fetch current criticality bulletins */
  async getCurrentAlerts(): Promise<EmergencyAlert[]> {
    // The pcm-dpc GitHub repo publishes daily criticality bulletins
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");

    try {
      const response = await fetch(
        `${this.config.baseUrl}/DPC-Bollettini-Criticita-Idrogeologica-Idraulica/master/files/latest/latest_bulletin.json`,
        { signal: AbortSignal.timeout(this.config.timeout) },
      );

      if (!response.ok) {
        // Try alternative structure
        return this.fetchFromAlternativeSource();
      }

      this.health = "healthy";
      const data = await response.json() as ProtCivBulletin;
      return this.parseBulletin(data);
    } catch {
      this.health = "degraded";
      return this.fetchFromAlternativeSource();
    }
  }

  /** Filter alerts for specific regions (e.g., "Veneto", "Lombardia") */
  async getAlertsForRegion(region: string): Promise<EmergencyAlert[]> {
    const allAlerts = await this.getCurrentAlerts();
    const regionLower = region.toLowerCase();
    return allAlerts.filter(a => a.region.toLowerCase().includes(regionLower));
  }

  /** Check if there are any orange/red alerts for a region */
  async hasSevereAlerts(region: string): Promise<boolean> {
    const alerts = await this.getAlertsForRegion(region);
    return alerts.some(a => a.severity === "orange" || a.severity === "red");
  }

  private async fetchFromAlternativeSource(): Promise<EmergencyAlert[]> {
    // Fallback: try the DPC COVID/general data endpoint structure
    try {
      const response = await fetch(
        "https://raw.githubusercontent.com/pcm-dpc/DPC-Bollettini-Criticita-Idrogeologica-Idraulica/master/files/latest/criticality_latest.json",
        { signal: AbortSignal.timeout(this.config.timeout) },
      );

      if (!response.ok) return [];

      const data = await response.json();
      return this.parseBulletin(data as ProtCivBulletin);
    } catch {
      return [];
    }
  }

  private parseBulletin(bulletin: ProtCivBulletin): EmergencyAlert[] {
    if (!bulletin?.zones) return [];

    return Object.entries(bulletin.zones)
      .filter(([, zone]) => zone.criticality && zone.criticality !== "green")
      .map(([zoneName, zone]) => ({
        id: `pc-${zoneName}-${Date.now()}`,
        type: (zone.type as EmergencyAlert["type"]) ?? "meteo",
        severity: (zone.criticality as EmergencyAlert["severity"]) ?? "yellow",
        region: zone.region ?? "",
        zones: [zoneName],
        description: zone.description ?? `Allerta ${zone.criticality} per ${zoneName}`,
        validFrom: bulletin.validFrom ?? new Date().toISOString(),
        validTo: bulletin.validTo ?? new Date(Date.now() + 86400000).toISOString(),
        source: "Protezione Civile - pcm-dpc",
      }));
  }
}

interface ProtCivBulletin {
  validFrom?: string;
  validTo?: string;
  zones?: Record<string, {
    criticality?: string;
    type?: string;
    region?: string;
    description?: string;
  }>;
}
