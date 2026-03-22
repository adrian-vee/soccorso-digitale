/**
 * In-memory + database-backed cache for API responses.
 *
 * Strategy:
 * - L1: In-memory Map (fast, limited size, per-process)
 * - L2: PostgreSQL api_cache table (persistent, shared across instances)
 *
 * TTLs are per-category (see CACHE_TTL in interfaces.ts).
 */

import { CacheEntry } from "./interfaces";

const MAX_MEMORY_ENTRIES = 5000;

export class ProviderCache {
  private readonly memory = new Map<string, CacheEntry<unknown>>();
  private readonly category: string;
  private readonly defaultTtlSeconds: number;

  constructor(category: string, defaultTtlSeconds: number) {
    this.category = category;
    this.defaultTtlSeconds = defaultTtlSeconds;
  }

  /** Build a namespaced cache key */
  buildKey(parts: readonly string[]): string {
    const normalized = parts.map(p => p.toLowerCase().trim().replace(/\s+/g, "_"));
    return `${this.category}:${normalized.join(":")}`;
  }

  /** Get from L1 memory cache */
  get<T>(key: string): CacheEntry<T> | null {
    const entry = this.memory.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return null;
    }

    // Update hit count (create new entry, immutable pattern)
    const updated: CacheEntry<T> = { ...entry, hitCount: entry.hitCount + 1 };
    this.memory.set(key, updated);
    return updated;
  }

  /** Store in L1 memory cache */
  set<T>(key: string, data: T, source: string, ttlSeconds?: number): CacheEntry<T> {
    const ttl = ttlSeconds ?? this.defaultTtlSeconds;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      key,
      data,
      createdAt: now,
      expiresAt: now + ttl * 1000,
      source,
      hitCount: 0,
    };

    // Evict oldest entries if at capacity
    if (this.memory.size >= MAX_MEMORY_ENTRIES) {
      this.evictOldest();
    }

    this.memory.set(key, entry);
    return entry;
  }

  /** Check if a key exists and is valid */
  has(key: string): boolean {
    const entry = this.memory.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.memory.delete(key);
      return false;
    }
    return true;
  }

  /** Invalidate a specific key */
  invalidate(key: string): void {
    this.memory.delete(key);
  }

  /** Invalidate all entries matching a prefix */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) {
        this.memory.delete(key);
        count++;
      }
    }
    return count;
  }

  /** Clear all entries in this category */
  clear(): void {
    this.memory.clear();
  }

  /** Get cache stats */
  stats(): { size: number; category: string; maxSize: number } {
    return {
      size: this.memory.size,
      category: this.category,
      maxSize: MAX_MEMORY_ENTRIES,
    };
  }

  /** Evict the 20% oldest entries */
  private evictOldest(): void {
    const entries = [...this.memory.entries()]
      .sort((a, b) => a[1].createdAt - b[1].createdAt);

    const toEvict = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toEvict; i++) {
      this.memory.delete(entries[i][0]);
    }
  }
}
