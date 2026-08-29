import type { ItineraryStep } from "@/types/itinerary";

/**
 * La carte d'un parcours, en image — ce qui manquait le plus à l'écran de choix.
 *
 * Trois propositions y étaient trois blocs de texte de même forme : on les comparait en lisant,
 * ce qui est précisément l'effort qu'on voulait épargner. Une vignette par proposition les rend
 * distinguables d'un coup d'œil, et surtout elle **informe** — un parcours compact et un parcours
 * étalé sur toute la ville ne se ressemblent pas, et c'est souvent ce qui décide.
 *
 * **Une carte plutôt qu'une photo, et ce n'est pas un pis-aller.** Il n'existe pas de source
 * gratuite de photos de bars et de restaurants : Wikimedia rend des images géolocalisées dans le
 * voisinage — pour « La cave d'à côté », le portrait d'une écrivaine au festival Quais du polar —
 * et les afficher serait un mensonge visuel, pire que pas d'image. Les photos de Google seraient
 * exactes mais coûteraient six fois le prix du modèle par génération. La carte, elle, est vraie,
 * gratuite dans le quota Mapbox, et dit quelque chose du parcours que le texte ne dit pas.
 */

const STATIC_URL = "https://api.mapbox.com/styles/v1/mapbox/light-v11/static";

/** Au-delà, l'image se charge de marqueurs illisibles. Un voyage de dix-huit étapes existe. */
const MARQUEURS_MAX = 6;

export function routeThumbnail(
  steps: ItineraryStep[],
  options: { largeur?: number; hauteur?: number } = {}
): string | null {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || steps.length === 0) return null;

  // La hauteur demandée est celle de l'affichage, au pixel près : une image plus haute que son
  // cadre est rognée par `object-cover`, et ce sont les marqueurs des extrémités qui sautent —
  // c'est-à-dire précisément ce qu'on veut montrer.
  //
  // Le calage tient à deux valeurs qui se contredisent. Un cadre trop plat ou un `padding` trop
  // large et l'aperçu dézoome jusqu'à empiler les marqueurs en un tas au milieu d'une carte de
  // ville : à 130 px de haut avec 42 px de marge, il ne restait que 46 px utiles, et trois bars
  // du même quartier devenaient un seul point sur « Bordeaux ». Un `padding` trop court, et les
  // marqueurs des extrémités touchent le bord. Le marqueur Mapbox ayant sa pointe en bas, il
  // déborde vers le haut : la marge doit tenir compte de sa hauteur, pas seulement de sa pointe.
  //
  // La marge basse est plus grande que les autres, et c'est délibéré : le titre est posé sur
  // l'image en bandeau d'encre, qui masquait un marqueur sur les écrans étroits — le cadrage se
  // resserre quand la carte rétrécit, et le marqueur le plus bas passait dessous.
  const { largeur = 400, hauteur = 168 } = options;

  // Sur un long parcours on garde des étapes réparties sur toute sa longueur, et non les
  // premières : c'est l'étendue qu'on veut faire voir, pas le début.
  const pas = Math.max(1, Math.ceil(steps.length / MARQUEURS_MAX));
  const retenues = steps.filter((_, i) => i % pas === 0).slice(0, MARQUEURS_MAX);

  const marqueurs = retenues
    .map((step, i) => {
      const { lat, lng } = step.location;
      // Vermillon : l'encre que le système réserve à ce qu'on suit.
      return `pin-s-${i + 1}+DD3B2E(${lng.toFixed(5)},${lat.toFixed(5)})`;
    })
    .join(",");

  // `auto` cadre sur l'ensemble des marqueurs : c'est ce cadrage qui rend visible la différence
  // entre un parcours de quartier et un parcours qui traverse la ville.
  return (
    `${STATIC_URL}/${marqueurs}/auto/${largeur}x${hauteur}@2x` +
    `?access_token=${token}&logo=false&attribution=false&padding=30,30,74,30`
  );
}
