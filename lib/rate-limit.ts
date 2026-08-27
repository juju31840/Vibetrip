/**
 * Rate limiting "best effort" en mémoire process — pas distribué, remis à zéro à chaque
 * redéploiement/instance serverless froide. Suffisant pour un MVP, à remplacer par
 * Upstash Redis ou équivalent si le trafic devient réel.
 */

interface Bucket {
  tokens: number;
  lastRefillAt: number;
}

/**
 * Quota par heure et par IP. Réglable via `VIBETRIP_RATE_LIMIT` dans `.env.local` : la valeur
 * par défaut protège le crédit API en production, mais elle est beaucoup trop basse pour tester
 * l'app depuis un téléphone — toutes les requêtes du réseau local partagent la même clé
 * « unknown » (aucun en-tête `x-forwarded-for` sans proxy devant), donc cinq essais suffisent à
 * bloquer la session pour une heure entière.
 */
const MAX_TOKENS = Number(process.env.VIBETRIP_RATE_LIMIT ?? 5);
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
