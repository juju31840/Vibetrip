/**
 * Rate limiting "best effort" en mémoire process — pas distribué, remis à zéro à chaque
 * redéploiement/instance serverless froide. Suffisant pour un MVP, à remplacer par
 * Upstash Redis ou équivalent si le trafic devient réel.
 */

interface Bucket {
  tokens: number;
  lastRefillAt: number;
}

const MAX_TOKENS = 5;
const REFILL_WINDOW_MS = 60 * 60 * 1000; // 1 heure pour reconstituer le quota complet

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing) {
    buckets.set(key, { tokens: MAX_TOKENS - 1, lastRefillAt: now });
    return { allowed: true, remaining: MAX_TOKENS - 1 };
  }

  const elapsed = now - existing.lastRefillAt;
  if (elapsed >= REFILL_WINDOW_MS) {
    existing.tokens = MAX_TOKENS;
    existing.lastRefillAt = now;
  }

  if (existing.tokens <= 0) {
    return { allowed: false, remaining: 0 };
  }

  existing.tokens -= 1;
  return { allowed: true, remaining: existing.tokens };
}
