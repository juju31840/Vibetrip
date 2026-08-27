/**
 * Villes proposées au départ. La liste sert de raccourci et d'autocomplétion, jamais de
 * restriction : le champ reste libre, et la génération fonctionne pour n'importe quelle
 * commune que le géocodage Mapbox sait résoudre. Elle est ici (et non dans le composant)
 * pour rester réutilisable si le front passe un jour à React Native.
 */
export const FRENCH_CITIES = [
  // Ordonnées par population de la commune (recensement INSEE), et non par préférence : les
  // six premières sont celles proposées d'emblée. La version précédente mettait en avant
  // Bordeaux et Lille — 9e et 10e — en omettant Toulouse et Nice, 4e et 5e, simplement parce
  // que c'étaient les villes de test. Un classement arbitraire dans une liste qui se présente
  // comme « les grandes villes » est une promesse non tenue.
  "Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes",
  "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes", "Reims",
  "Saint-Étienne", "Le Havre", "Toulon", "Grenoble", "Dijon", "Angers",
  "Nîmes", "Villeurbanne", "Clermont-Ferrand", "Le Mans", "Aix-en-Provence", "Brest",
  "Tours", "Amiens", "Limoges", "Annecy", "Perpignan", "Boulogne-Billancourt",
  "Metz", "Besançon", "Orléans", "Rouen", "Argenteuil", "Mulhouse",
  "Montreuil", "Caen", "Nancy", "Roubaix", "Tourcoing", "Nanterre",
  "Avignon", "Poitiers", "La Rochelle", "Bayonne", "Biarritz", "Colmar",
  "Deauville", "Chamonix-Mont-Blanc",
] as const;

/**
 * Proposées d'emblée sous le champ : les six communes les plus peuplées. Ce sont aussi celles
 * pour lesquelles la vérification des lieux fonctionne le mieux, le référentiel étant plus
 * fourni dans les grandes villes.
 */
export const SUGGESTED_CITIES = FRENCH_CITIES.slice(0, 6);

/** Filtre la liste sur une saisie partielle, accents et casse ignorés. */
export function matchCities(query: string, limit = 6): string[] {
  const normalized = normalize(query);
  if (!normalized) return [];
  return FRENCH_CITIES.filter((city) => normalize(city).startsWith(normalized)).slice(0, limit);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
