import { THEMES } from "./themes";
import type { PlaceCandidate } from "./places-db";
import type { GenerateItineraryRequest } from "@/types/itinerary";

const MODE_LABELS: Record<GenerateItineraryRequest["mode"], string> = {
  tonight: "une soirée (aujourd'hui, en une seule journée)",
  weekend: "un week-end",
  trip: "un voyage de plusieurs jours",
};

/**
 * Nombre de jours imposé par mode — évite de laisser Claude choisir librement
 * (source d'incohérence entre générations pour un même réglage). Pour "trip",
 * le curseur Distance sert de proxy à l'étendue du voyage (0 → 3 jours, 100 → 6 jours).
 */
export function totalDaysForMode(mode: GenerateItineraryRequest["mode"], distance: number): number {
  if (mode === "tonight") return 1;
  if (mode === "weekend") return 2;
  const t = Math.min(100, Math.max(0, distance)) / 100;
  return Math.round(3 + t * 3);
}

const DISTANCE_HINTS: Record<GenerateItineraryRequest["mode"], string> = {
  tonight:
    "Le curseur Distance représente un rayon de marche/court trajet autour du point de départ (0 = à pied, 100 = quelques kilomètres en transport).",
  weekend:
    "Le curseur Distance représente le rayon d'exploration autour du point de départ (0 = quartier proche, 100 = excursions à plusieurs dizaines de kilomètres).",
  trip:
    "Le curseur Distance représente l'étendue du séjour à l'intérieur d'une même région (0 = une seule ville, 100 = plusieurs villes voisines, à moins de deux heures de route du point de départ).",
};

/**
 * Cinq paliers et non trois. Avec trois, le palier central couvrait un tiers de la course du
 * curseur : on pouvait le déplacer longuement sans que le mot affiché ne bouge, ce qui donnait
 * l'impression d'un réglage sans effet. Cinq paliers de 25 points font changer le mot à chaque
 * cran, et le curseur avance désormais par pas de 25 (components/ui/Slider.tsx) : chaque
 * position possible correspond exactement à un palier.
 */
export const LEVEL_COUNT = 5;

export function levelIndex(value: number): number {
  const clamped = Math.min(100, Math.max(0, value));
  return Math.min(LEVEL_COUNT - 1, Math.round((clamped / 100) * (LEVEL_COUNT - 1)));
}

function describeLevel(value: number, labels: readonly string[]): string {
  return labels[levelIndex(value)] ?? labels[labels.length - 1]!;
}

/**
 * Consignes envoyées au modèle, palier par palier. Elles sont volontairement plus explicites
 * que les mots affichés à l'écran (`lib/vibe-labels.ts`) mais décrivent exactement la même
 * chose : ce que l'utilisateur lit doit être ce que le modèle reçoit.
 */
const BUDGET_INSTRUCTIONS = [
  "budget très serré, privilégier ce qui est gratuit ou presque",
  "petit budget, options peu coûteuses",
  "budget modéré, ni bon marché ni haut de gamme",
  "budget confortable, de belles adresses sont possibles",
  "budget large, le haut de gamme est bienvenu",
] as const;

const AMBIANCE_INSTRUCTIONS = [
  "ambiance très calme, presque contemplative",
  "ambiance tranquille et posée",
  "ambiance conviviale, animée sans excès",
  "ambiance animée, lieux vivants et fréquentés",
  "ambiance festive et énergique, sortie nocturne",
] as const;

/**
 * Traduit les envies cochées à l'écran en consigne.
 *
 * Formulée en « principalement » et « au moins la moitié », et jamais en exclusivité : cocher
 * « Manger » sur un voyage de six jours ne doit pas produire dix-huit restaurants. L'envie oriente
 * la sélection, elle ne remplace pas la composition d'un parcours qui tient debout.
 */
function describeThemes(themes: GenerateItineraryRequest["themes"]): string | null {
  if (!themes || themes.length === 0) return null;

  const wanted = THEMES.filter((theme) => themes.includes(theme.id)).map((theme) => theme.prompt);
  if (wanted.length === 0) return null;

  const list =
    wanted.length === 1
      ? wanted[0]!
      : `${wanted.slice(0, -1).join(", ")} et ${wanted[wanted.length - 1]!}`;

  return `L'utilisateur a envie surtout de : ${list}. Compose principalement autour de ces envies — au moins la moitié des étapes doivent en relever. Les autres étapes restent libres pour que le parcours tienne debout (un enchaînement de six restaurants n'est pas un itinéraire).`;
}

function describeLocation(location: GenerateItineraryRequest["location"]): string {
  if ("city" in location) {
    return `la ville de ${location.city}`;
  }
  return `les coordonnées GPS approximatives (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`;
}

export function buildSystemPrompt(angle: string): string {
  return [
    "Tu es un générateur d'itinéraires de voyage/sortie pour l'application VibeTrip.",
    "Tu dois répondre UNIQUEMENT avec un objet JSON conforme au schéma structuré fourni, sans texte additionnel.",
    `Angle imposé pour cet itinéraire : ${angle}`,
    "Le champ summary tient en une phrase courte et dit ce qui caractérise cet itinéraire, dans l'esprit de l'angle demandé. N'y répète jamais le nom de la ville ni le tripName.",
    "N'invente jamais un lieu. Si tu n'es pas certain qu'un établissement existe encore et porte bien ce nom, choisis-en un autre dont tu es sûr : l'utilisateur s'y rend réellement.",
    "Quand une liste de lieux vérifiés t'est fournie, compose l'itinéraire à partir d'elle : pour chaque étape, reporte la référence du lieu choisi dans le champ ref, et recopie son nom et ses coordonnées à l'identique. Cette liste contient des lieux dont l'existence et l'adresse sont établies — c'est ce qui évite d'envoyer quelqu'un à une adresse qui n'existe plus.",
    "Cette liste n'est pas un classement : elle mêle des adresses remarquables et des enseignes banales. Choisis celles qui valent le déplacement et ignore les autres, c'est précisément ce qu'on attend de toi. Si un lieu manquant t'est indispensable, tu peux le proposer sans ref — mais uniquement si tu es certain qu'il existe.",
    "Toutes les chaînes de caractères (tripName, description, placeName) doivent être rédigées en français.",
    "Les descriptions doivent être courtes (1 à 2 phrases).",
    "Les coordonnées GPS (lat/lng) doivent rester réalistes et cohérentes avec le point de départ.",
    "Reste dans la même région que le point de départ, même en mode voyage et même avec une distance maximale : un séjour au départ de Lyon peut aller à Annecy ou Grenoble, jamais à Paris ni à Bordeaux. Traverser la France n'est pas un itinéraire, c'est un déménagement.",
  ].join(" ");
}

/**
 * La liste des lieux réels, telle qu'elle est présentée au modèle.
 *
 * Format volontairement compact — une ligne par lieu, sans ponctuation superflue : à 90 candidats,
 * chaque caractère est payé trois fois, une fois par proposition parallèle. Les coordonnées y
 * figurent avec cinq décimales pour que le modèle les recopie plutôt que de les approximer.
 */
function describeCandidates(candidates: PlaceCandidate[]): string | null {
  if (candidates.length === 0) return null;

  const lignes = candidates.map((c) => {
    const adresse = c.address ? `, ${c.address}` : "";
    return `${c.ref} | ${c.name}${adresse} | ${c.type} | ${c.location.lat.toFixed(5)},${c.location.lng.toFixed(5)}`;
  });

  return [
    `Lieux vérifiés disponibles autour du point de départ (${candidates.length}) — format : ref | nom, adresse | type | lat,lng`,
    ...lignes,
    "Compose l'itinéraire avec ces lieux. Pour chaque étape : ref = la référence, placeName = le nom exact, location = les coordonnées telles quelles.",
  ].join("\n");
}

export function buildUserPrompt(
  request: GenerateItineraryRequest,
  candidates: PlaceCandidate[] = []
): string {
  const { budget, ambiance, distance, mode, location, themes } = request;

  const budgetLabel = describeLevel(budget, BUDGET_INSTRUCTIONS);
  const ambianceLabel = describeLevel(ambiance, AMBIANCE_INSTRUCTIONS);

  const totalDays = totalDaysForMode(mode, distance);

  return [
    `Génère un itinéraire pour ${MODE_LABELS[mode]}.`,
    `Il doit durer exactement ${totalDays} jour(s) : totalDays doit valoir ${totalDays}, et chaque étape doit avoir un champ day compris entre 1 et ${totalDays}.`,
    `Point de départ : ${describeLocation(location)}.`,
    `Budget souhaité (0-100=${budget}) : ${budgetLabel}.`,
    `Ambiance souhaitée (0-100=${ambiance}) : ${ambianceLabel}.`,
    `Distance souhaitée (0-100=${distance}). ${DISTANCE_HINTS[mode]}`,
    "Structure les étapes par jour (day, à partir de 1) et par période (morning/midday/evening), avec au moins une étape par période pertinente.",
    "Choisis un type (`type`) cohérent pour chaque étape parmi la liste imposée par le schéma.",
    describeThemes(themes),
    describeCandidates(candidates),
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/**
 * Angles imposés aux propositions. Ils sont explicites plutôt que laissés à l'initiative du
 * modèle : mesuré en réel, trois générations libres et parallèles convergent vers les mêmes
 * lieux célèbres. Un angle par appel garantit que le choix offert à l'utilisateur en est un.
 */
export const PROPOSAL_ANGLES = [
  "les incontournables — le cœur historique et les lieux que tout le monde recommande.",
  "hors des sentiers battus — des quartiers moins touristiques, des adresses de habitués.",
  "autour de la table — la sélection est guidée par les bonnes adresses où manger et boire.",
];
