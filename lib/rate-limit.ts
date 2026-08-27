/**
 * Quota de génération, par IP et par heure.
 *
 * **Persisté en base depuis le 27/08/2026, et ce n'est pas un raffinement.** Le compteur vivait
 * en mémoire du processus : en serverless, chaque instance froide repart avec un compteur neuf,
 * ce qui revient à n'avoir aucune limite dès lors que l'application est publique. Tant qu'elle
 * tournait sur un poste de développement, la faiblesse restait théorique ; exposée sur Internet
 * avec une clé API derrière, elle offrait le crédit au premier venu.
 *
 * Le décompte se fait en un seul aller-retour (`consommer_quota`, `security definer`) : lire puis
 * écrire laisserait une fenêtre où deux appels simultanés passent tous les deux.
 *
 * Repli volontaire : si la base ne répond pas, on **autorise**. Un socle indisponible ne doit pas
 * empêcher quelqu'un de générer son itinéraire — le quota protège une dépense, il n'est pas une
 * fonction de sécurité.
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

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  if (URL_BASE && CLE) {
    try {
      const response = await fetch(`${URL_BASE}/rest/v1/rpc/consommer_quota`, {
        method: "POST",
        headers: { apikey: CLE, Authorization: `Bearer ${CLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_cle: key, p_max: MAX_TOKENS }),
      });
      if (response.ok) {
        const [ligne] = (await response.json()) as { autorise: boolean; restant: number }[];
        if (ligne) return { allowed: ligne.autorise, remaining: ligne.restant };
      }
    } catch {
      // Base injoignable : on retombe sur le compteur mémoire plutôt que de bloquer l'utilisateur.
    }
  }
  return checkInMemory(key);
}

/** Repli hors ligne, et seul mode disponible en développement sans identifiants Supabase. */
function checkInMemory(key: string): RateLimitResult {
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
