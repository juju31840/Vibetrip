/**
 * Comparaison de noms de lieux — le cœur de la vérification (lib/verify-places.ts).
 *
 * Isolé dans son propre module, sans `server-only` ni dépendance : c'est la partie **pure** et
 * la plus risquée du produit (elle décide si l'on affiche « adresse confirmée » à quelqu'un qui
 * va s'y rendre), donc elle doit pouvoir être rejouée hors de Next sur des cas réels —
 * `npm run check:match`.
 */

/** Part minimale des mots distinctifs de la requête qui doit se retrouver dans le résultat. */
export const MIN_QUERY_TOKEN_COVERAGE = 0.5;

/**
 * Un résultat qui n'est pas un POI doit correspondre à TOUS les mots distinctifs de la requête,
 * pas seulement à la moitié. Sans cette règle, un lieu inventé se ferait confirmer par la simple
 * zone qu'il mentionne : « Club Pigalle Nights » matcherait le quartier « Pigalle », à 0 km, et
 * l'utilisateur partirait confiant vers un club qui n'existe pas.
 */
export const AREA_TOKEN_COVERAGE = 1;

/**
 * Plafond de mots distinctifs que le résultat peut ajouter — voir `allowedExtraTokens`.
 *
 * Ce verrou a été ajouté le 27/08/2026 après un faux positif observé en production : « Marché
 * des Capucins » avait été **confirmé** par « Marché des Capucins - Calme - Lumineux - Garage -
 * Entire Place », une annonce de location. Les deux verrous existants la laissaient passer, la
 * requête étant entièrement contenue dans le titre de l'annonce — c'est la variante « l'annonce
 * commence par le vrai nom » du piège déjà connu (« Constantine Terreaux »).
 */
export const MAX_EXTRA_CANDIDATE_TOKENS = 2;

/**
 * Combien de mots distinctifs un résultat peut ajouter à la requête sans cesser de la désigner.
 *
 * Gradué, et c'est le point : plus la requête est distinctive, plus une addition est anodine.
 * « Basilique Notre-Dame de Fourvière » supporte « | Lyon ». « Le Baron » ne supporte rien —
 * le banc a montré qu'un plafond fixe de 2 le faisait confirmer par **« Le Baron Rouge »**,
 * c'est-à-dire par un autre bar, ce que ce module existe précisément pour empêcher.
 */
function allowedExtraTokens(queryTokenCount: number): number {
  return Math.min(MAX_EXTRA_CANDIDATE_TOKENS, Math.max(0, queryTokenCount - 2));
}

/**
 * Mots qui disent **quelle sorte de lieu** on cherche. Ils sont filtrés comme génériques pour la
 * comparaison des noms — deux cafés ne se ressemblent pas parce qu'ils sont tous deux des cafés —
 * mais ils portent une information qu'on ne peut pas jeter : si le modèle annonce un café et que
 * le référentiel rend une place, ce n'est pas le même objet.
 *
 * Ajouté après un second faux positif relevé au banc : « Café de la Place Colette » — un lieu
 * inventé, dont CLAUDE.md documente qu'il s'appelle en réalité Le Nemours — était confirmé par
 * « Place Colette », la place elle-même. Une fois les mots génériques retirés des deux côtés, il
 * ne restait que « colette » de part et d'autre, et tous les verrous tombaient.
 */
const VENUE_TOKENS = new Set([
  "cafe", "restaurant", "resto", "bar", "brasserie", "bistrot", "bistro", "bouchon",
  "club", "musee", "hotel", "auberge", "cinema", "theatre", "marche",
]);

/**
 * Mots trop courants pour identifier un lieu. Sans ce filtrage, « Place des Terreaux » matcherait
 * l'annonce de location « Constantine Terreaux - Entire Place » sur le seul mot « place ».
 */
const GENERIC_TOKENS = new Set([
  "le", "la", "les", "l", "un", "une", "du", "de", "des", "d", "au", "aux", "et", "a", "the",
  "chez", "restaurant", "resto", "bar", "cafe", "brasserie", "bistrot", "bistro", "bouchon",
  "club", "hotel", "auberge", "musee", "jardin", "parc", "place", "rue", "avenue", "boulevard",
  "quai", "pl", "av", "bd",
]);

/**
 * Découpe un nom en mots comparables : sans accents, sans ponctuation, sans pluriel et sans les
 * mots génériques ci-dessus. La dépluralisation est appliquée des deux côtés, donc « Jardins du
 * Palais Royal » et « Jardin du Palais Royal » se rejoignent.
 */
function normalizedWords(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((token) => (token.length > 3 && token.endsWith("s") ? token.slice(0, -1) : token))
    .filter((token) => token.length >= 2);
}

export function significantTokens(name: string): string[] {
  return normalizedWords(name).filter((token) => !GENERIC_TOKENS.has(token));
}

/**
 * Deux noms désignent-ils le même lieu ? Trois conditions cumulatives :
 *
 * 1. Le premier mot distinctif du résultat doit figurer dans la requête. C'est ce qui écarte
 *    « Baronne » pour « Le Baron » et « Constantine Terreaux » pour « Place des Terreaux ».
 * 2. La requête doit être suffisamment couverte, pour qu'un simple mot en commun ne suffise pas.
 * 3. Le résultat ne doit pas ajouter plus de mots distinctifs que la requête n'en supporte
 *    (`allowedExtraTokens`) — verrou contre les annonces d'agrégateurs qui commencent par le
 *    vrai nom du lieu, et contre les voisins homonymes du type « Le Baron » / « Le Baron Rouge ».
 * 4. Si la requête dit quelle sorte de lieu on cherche (café, musée, marché…), le résultat doit
 *    le dire aussi — sans quoi une place confirme le café qui porte son nom.
 */
export function namesMatch(
  query: string,
  candidate: string,
  minCoverage = MIN_QUERY_TOKEN_COVERAGE
): boolean {
  const queryTokens = significantTokens(query);
  const candidateTokens = significantTokens(candidate);
  if (queryTokens.length === 0 || candidateTokens.length === 0) return false;

  if (!queryTokens.includes(candidateTokens[0]!)) return false;

  const matched = queryTokens.filter((token) => candidateTokens.includes(token)).length;
  if (matched / queryTokens.length < minCoverage) return false;

  const extra = candidateTokens.filter((token) => !queryTokens.includes(token)).length;
  if (extra > allowedExtraTokens(queryTokens.length)) return false;

  const queryVenues = normalizedWords(query).filter((word) => VENUE_TOKENS.has(word));
  if (queryVenues.length === 0) return true;

  const candidateWords = normalizedWords(candidate);
  return queryVenues.some((venue) => candidateWords.includes(venue));
}
