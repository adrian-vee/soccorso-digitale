/**
 * Circuit Breaker pattern for external API calls.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Provider is down, requests fail immediately (fast-fail)
 * - HALF_OPEN: Testing if provider recovered (allow 1 request through)
 *
 * Transitions:
 * - CLOSED → OPEN: After `failureThreshold` consecutive failures
 * - OPEN → HALF_OPEN: After `resetTimeout` ms
 * - HALF_OPEN → CLOSED: On success
 * - HALF_OPEN → OPEN: On failure
 */

export type CircuitState = "closed" | "open" | "half_open";

export interface CircuitBreakerConfig {
  readonly failureThreshold: number;  // failures before opening
  readonly resetTimeout: number;       // ms before trying half-open
  readonly monitorWindow: number;      // ms window for failure counting
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30_000,      // 30 seconds
  monitorWindow: 60_000,     // 1 minute
};

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures: number[] = [];  // timestamps of failures
  private lastFailureTime = 0;
  private readonly config: CircuitBreakerConfig;
  readonly providerName: string;

  constructor(providerName: string, config?: Partial<CircuitBreakerConfig>) {
    this.providerName = providerName;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Check if the circuit allows requests */
  canRequest(): boolean {
    this.pruneOldFailures();

    switch (this.state) {
      case "closed":
        return true;
      case "open": {
        const elapsed = Date.now() - this.lastFailureTime;
        if (elapsed >= this.config.resetTimeout) {
          this.state = "half_open";
          return true;
        }
        return false;
      }
      case "half_open":
        return true;
    }
  }

  /** Record a successful call */
  recordSuccess(): void {
    if (this.state === "half_open") {
      this.state = "closed";
      this.failures = [];
    }
  }

  /** Record a failed call */
  recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    this.lastFailureTime = now;

    this.pruneOldFailures();

    if (this.state === "half_open") {
      this.state = "open";
      return;
    }

    if (this.failures.length >= this.config.failureThreshold) {
      this.state = "open";
    }
  }

  /** Get current state */
  getState(): CircuitState {
    // Check if open circuit should transition to half_open
    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.resetTimeout) {
        this.state = "half_open";
      }
    }
    return this.state;
  }

  /** Force reset (for admin/testing) */
  reset(): void {
    this.state = "closed";
    this.failures = [];
    this.lastFailureTime = 0;
  }

  /** Get circuit stats */
  stats(): {
    state: CircuitState;
    recentFailures: number;
    lastFailure: number;
    provider: string;
  } {
    this.pruneOldFailures();
    return {
      state: this.getState(),
      recentFailures: this.failures.length,
      lastFailure: this.lastFailureTime,
      provider: this.providerName,
    };
  }

  /** Remove failures outside the monitoring window */
  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.config.monitorWindow;
    this.failures = this.failures.filter(t => t > cutoff);
  }
}
