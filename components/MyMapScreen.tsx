"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { chipClass } from "@/components/ui/chip";
import { itinerariesForCity, type CityItinerary } from "@/lib/city-itineraries";
import { lastVisitTime, type VisitedPlace } from "@/lib/places-store";
import type { SavedItinerary } from "@/lib/storage";
import { MODE_LABELS } from "@/lib/trip-modes";
import type { MapPoint, PlaceType } from "@/types/itinerary";

const MapView = dynamic(() => import("@/components/MapView").then((mod) => mod.MapView), {
  ssr: false,
});

const TYPE_LABELS: Record<PlaceType, string> = {
  restaurant: "Restaurants",
  bar: "Bars",
  cafe: "Cafés",
  museum: "Musées",
  park: "Parcs",
  viewpoint: "Points de vue",
  activity: "Activités",
  shopping: "Boutiques",
  nightlife: "Sorties de nuit",
  hotel: "Hôtels",
  transport: "Trajets",
  other: "Autres",
};

/** Au-delà, la répartition cesse d'être lisible et redevient une liste. */
const TOP_TYPES = 4;

/** Lieux dont la commune n'a pas pu être résolue (géocodage indisponible). */
const UNKNOWN_CITY = "Ailleurs";

/**
 * Vue France. Exportée parce que la ville ouverte vit **au-dessus** de cet écran : ouvrir une
 * sortie démonte la coque à onglets, et un état gardé ici renverrait sur la France au retour —
 * exactement le défaut déjà corrigé sur les réglages de l'écran « Créer ».
 */
export const ALL_ZONES = "__all__";

interface MyMapScreenProps {
  places: VisitedPlace[];
  /** L'historique complet : c'est lui qu'on croise avec les lieux pour retrouver les sorties. */
  saved: SavedItinerary[];
  /** Ville ouverte, ou `ALL_ZONES` pour la vue France. Contrôlée depuis `app/page.tsx`. */
  zone: string;
  onZoneChange: (zone: string) => void;
  onOpenItinerary: (id: string) => void;
}

/**
 * La contrepartie du geste « j'y suis allé » — ce qui manquait à la boucle d'usage.
 *
 * Jusqu'ici cocher une étape ne rendait rien : l'utilisateur donnait une information et
 * n'obtenait aucun retour. Ici chaque case cochée pose un point qui reste.
 *
 * **L'écran s'ouvre sur la France entière**, et c'est délibéré : c'est la vue qui donne la mesure
 * de la collection — combien de villes, où l'on n'est jamais allé. Une ville isolée ne dirait
 * rien de tout ça. Sur cette vue, chaque ville est **un seul marqueur portant son nombre de
 * lieux** : superposer les points d'une même ville à cette échelle produirait une tache noire.
 * On entre ensuite dans une ville d'un geste, sur le marqueur ou sur son onglet.
 */
export function MyMapScreen({
  places,
  saved,
  zone: requestedZone,
  onZoneChange,
  onOpenItinerary,
}: MyMapScreenProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  function setZone(next: string) {
    onZoneChange(next);
    setActiveId(null);
  }

  const sorted = useMemo(
    () => [...places].sort((a, b) => lastVisitTime(b) - lastVisitTime(a)),
    [places]
  );

  /** Villes présentes, de la plus récemment fréquentée à la plus ancienne. */
  const cities = useMemo(() => {
    const seen: { name: string; count: number; lat: number; lng: number }[] = [];
    for (const place of sorted) {
      const name = place.city ?? UNKNOWN_CITY;
      const found = seen.find((item) => item.name === name);
      if (found) {
        found.count += 1;
        // Centroïde courant : le marqueur de ville se pose au milieu de ses lieux.
        found.lat += (place.location.lat - found.lat) / found.count;
        found.lng += (place.location.lng - found.lng) / found.count;
      } else {
        seen.push({ name, count: 1, lat: place.location.lat, lng: place.location.lng });
      }
    }
    return seen;
  }, [sorted]);

  /**
   * Une ville dont on a décoché le dernier lieu disparaît de la liste. La ville ouverte survivant
   * désormais au démontage de l'écran, l'onglet pourrait pointer sur un ensemble vide — d'où ce
   * repli sur la vue France, calculé plutôt que corrigé par un effet.
   */
  const zone =
    requestedZone !== ALL_ZONES && !cities.some((city) => city.name === requestedZone)
      ? ALL_ZONES
      : requestedZone;

  const isOverview = zone === ALL_ZONES;
  const shown = useMemo(
    () => (isOverview ? sorted : sorted.filter((p) => (p.city ?? UNKNOWN_CITY) === zone)),
    [sorted, zone, isOverview]
  );

  /**
   * Les sorties rattachées à la ville ouverte. Uniquement sous un onglet de ville : sur la vue
   * France, « les sorties d'ici » n'aurait aucun sens — ce serait l'onglet « Mes sorties », déjà
   * à un geste de là.
   *
   * « Ailleurs » ne bénéficie pas du rattachement par proximité : il rassemble les lieux dont la
   * commune n'a pas pu être résolue, donc des points dispersés dans tout le pays entre lesquels
   * une distance ne veut rien dire (lib/city-itineraries.ts).
   */
  const cityItineraries = useMemo(
    () => (isOverview ? [] : itinerariesForCity(saved, shown, zone !== UNKNOWN_CITY)),
    [isOverview, saved, shown, zone]
  );

  const points: MapPoint[] = useMemo(
    () =>
      isOverview
        ? cities.map((city) => ({
            id: `city:${city.name}`,
            placeName: `${city.name} — ${city.count} lieux`,
            location: { lat: city.lat, lng: city.lng },
            label: String(city.count),
          }))
        : shown.map((p) => ({ id: p.key, placeName: p.placeName, location: p.location })),
    [isOverview, cities, shown]
  );

  const visitCount = shown.reduce((total, place) => total + place.visits.length, 0);

  function handleMarker(id: string) {
    // Sur la vue d'ensemble, un marqueur est une ville : le presser y entre.
    if (id.startsWith("city:")) {
      setZone(id.slice("city:".length));
      return;
    }
    setActiveId(id);
  }

  if (places.length === 0) {
    return (
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-6 pt-10">
        <Title />
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto pb-6">
      <div className="px-6 pt-10">
        <Title />
      </div>

      {/* `shrink-0` comme sur la carte : dans une colonne flex, une rangée sans hauteur fixe est
          compressible, et celle-ci se retrouvait réduite à un liseré de quelques pixels. */}
      <div className="mt-3 flex shrink-0 gap-1.5 overflow-x-auto px-6 pb-1">
        <ZoneChip label="France" active={isOverview} onSelect={() => setZone(ALL_ZONES)} />
        {cities.map((city) => (
          <ZoneChip
            key={city.name}
            label={city.name}
            count={city.count}
            active={zone === city.name}
            onSelect={() => setZone(city.name)}
          />
        ))}
      </div>

      {/* `shrink-0` indispensable : dans une colonne flex, une hauteur en `dvh` reste compressible
          et la carte se retrouvait écrasée à un bandeau d'une centaine de pixels dès que la liste
          en dessous s'allongeait. C'est le même piège que sur l'écran de détail d'une proposition. */}
      <div className="mt-3 h-[38dvh] min-h-[220px] w-full shrink-0 overflow-hidden border-y-2 border-ink">
        <MapView
          points={points}
          activeId={activeId}
          onMarkerClick={handleMarker}
          numbered={false}
          focusZoom={14}
        />
      </div>

      <div className="flex flex-col gap-5 px-6 pt-4">
        {/* Le compte de villes ne paraît que sur la vue d'ensemble. Sous un onglet de ville il
            restait global, à côté de deux voisins qui, eux, suivaient le filtre : on lisait
            « 2 lieux · 2 passages · 3 villes » en étant dans une seule ville. Une rangée dont
            une case sur trois ne parle pas du même ensemble que les autres se lit de travers. */}
        <div className={clsx("grid border-2 border-ink", isOverview ? "grid-cols-3" : "grid-cols-2")}>
          <Stat value={shown.length} label={shown.length > 1 ? "lieux" : "lieu"} />
          <Stat value={visitCount} label={visitCount > 1 ? "passages" : "passage"} bordered />
          {isOverview && (
            <Stat value={cities.length} label={cities.length > 1 ? "villes" : "ville"} bordered />
          )}
        </div>

        {!isOverview && (
          <CityItineraries city={zone} items={cityItineraries} onOpen={onOpenItinerary} />
        )}

        <TypeBreakdown places={shown} />

        <section className="flex flex-col">
          <h2 className="border-b-2 border-ink pb-1.5 text-overline uppercase text-ink-soft">
            {isOverview ? "Tous les lieux" : zone}
          </h2>
          <ul className="flex flex-col">
            {shown.map((place) => (
              <li key={place.key}>
                <button
                  type="button"
                  onClick={() => setActiveId(place.key)}
                  aria-pressed={activeId === place.key}
                  className={clsx(
                    "flex w-full flex-col border-b-2 border-ink py-2.5 text-left transition-colors",
                    activeId === place.key && "bg-paper-2"
                  )}
                >
                  <span className="truncate font-display text-[1.2rem] uppercase leading-none tracking-[-0.01em] text-ink">
                    {place.placeName}
                  </span>
                  <span className="mt-1 truncate text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-mute">
                    {TYPE_LABELS[place.type]}
                    {/* La ville n'est répétée que sur la vue d'ensemble : sous un onglet de
                        ville, la redire à chaque ligne serait du bruit. */}
                    {isOverview && place.city ? ` · ${place.city}` : ""}
                    {` · ${formatVisit(place)}`}
                    {place.visits.length > 1 && ` · ${place.visits.length} passages`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Voir `SavedScreen` : le masthead ne porte que le titre et son filet, sur les trois onglets. */
function Title() {
  return (
    <div className="flex items-end justify-between border-b-3 border-ink pb-2">
      <h1 className="font-display text-[2.6rem] uppercase leading-[0.85] tracking-[-0.015em] text-ink">
        Ma carte
      </h1>
    </div>
  );
}

function ZoneChip({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count?: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={chipClass(active, "shrink-0")}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 opacity-70">{count}</span>}
    </button>
  );
}

function Stat({ value, label, bordered }: { value: number; label: string; bordered?: boolean }) {
  return (
    <div className={clsx("flex flex-col px-3 py-2.5", bordered && "border-l-2 border-ink")}>
      <span className="font-display text-[2rem] leading-none text-accent">{value}</span>
      <span className="mt-1 text-[0.625rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
    </div>
  );
}

/**
 * Les sorties d'une ville — ce qui referme la boucle dans l'autre sens.
 *
 * Jusqu'ici la carte ne rendait que des points isolés : on retrouvait le nom d'un bar sans jamais
 * pouvoir revenir à la soirée dont il faisait partie. Or c'est le parcours qu'on garde en tête,
 * pas la coordonnée. Chaque ligne rouvre la sortie en plein écran, avec ses étapes et ses cases
 * à cocher — donc une sortie entamée se reprend d'ici, sans passer par « Mes sorties ».
 *
 * **Le suivi est une barre et un compte**, pas seulement un compte : « 3/8 » demande à être lu,
 * une barre se voit. Elle est en outremer, l'encre que le système réserve au factuel — une
 * progression constate, elle n'appelle pas à agir. Le vermillon reste au seul bouton.
 *
 * Une sortie **jamais entamée** est marquée « pas encore faite » plutôt que « 0/8 » : un zéro sur
 * une barre vide se lit comme un échec, alors que c'est un programme en attente. Et c'est aussi
 * la seule qu'on ne rattache pas à la ville par preuve directe mais par proximité — le dire
 * évite d'affirmer un passage qui n'a pas eu lieu.
 */
function CityItineraries({
  city,
  items,
  onOpen,
}: {
  city: string;
  items: CityItinerary[];
  onOpen: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col">
      <h2 className="flex items-end justify-between border-b-2 border-ink pb-1.5 text-overline uppercase text-ink-soft">
        <span>{`Tes sorties à ${city}`}</span>
        <span className="text-ink-mute">{items.length}</span>
      </h2>
      <ul className="flex flex-col">
        {items.map(({ entry, done, total, walked }) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onOpen(entry.id)}
              className="flex w-full flex-col border-b-2 border-ink py-3 text-left"
            >
              <span className="truncate font-display text-[1.2rem] uppercase leading-none tracking-[-0.01em] text-ink">
                {entry.itinerary.tripName}
              </span>
              <span className="mt-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-ink-mute">
                {MODE_LABELS[entry.itinerary.mode]}
                {` · ${formatShortDate(new Date(entry.savedAt).getTime())}`}
                {walked ? (
                  <span className="text-blue">{` · ${done}/${total} faites`}</span>
                ) : (
                  " · pas encore faite"
                )}
              </span>
              {walked && total > 0 && (
                <span aria-hidden className="mt-2 h-2 w-full border-2 border-ink">
                  <span
                    className="block h-full bg-blue"
                    style={{ width: `${Math.round((done / total) * 100)}%` }}
                  />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * La répartition par type — le versant « journal » de la carte : ce qu'on fait vraiment, mesuré
 * plutôt que déclaré. Barres d'une seule encre et non une par type : douze couleurs seraient la
 * même erreur que celle déjà corrigée sur les marqueurs, un semis qu'on ne lit plus.
 *
 * Masquée tant qu'il n'y a **rien à comparer** : trois types à un passage chacun donnaient trois
 * barres pleines identiques, ce qui n'apprend rien et ressemble à un affichage cassé.
 */
function TypeBreakdown({ places }: { places: VisitedPlace[] }) {
  const counts = new Map<PlaceType, number>();
  for (const place of places) {
    counts.set(place.type, (counts.get(place.type) ?? 0) + place.visits.length);
  }

  const ranked = [...counts.entries()].sort(([, a], [, b]) => b - a).slice(0, TOP_TYPES);
  if (ranked.length < 2) return null;

  const highest = ranked[0]![1];
  const lowest = ranked[ranked.length - 1]![1];
  if (highest === lowest) return null;

  return (
    <section className="flex flex-col">
      <h2 className="border-b-2 border-ink pb-1.5 text-overline uppercase text-ink-soft">
        Ce que tu fais
      </h2>
      <ul className="flex flex-col gap-2 pt-2.5">
        {ranked.map(([type, count]) => (
          <li key={type} className="flex items-center gap-2.5">
            <span className="w-24 shrink-0 truncate text-[0.6875rem] font-bold uppercase tracking-[0.06em] text-ink-soft">
              {TYPE_LABELS[type]}
            </span>
            <span className="h-3 flex-1 border-2 border-ink">
              <span
                className="block h-full bg-blue"
                style={{ width: `${Math.round((count / highest) * 100)}%` }}
              />
            </span>
            <span className="w-5 shrink-0 text-right text-caption font-bold tabular-nums text-ink">
              {count}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * L'état vide dit quel geste remplit la carte. « Aucun lieu » n'apprendrait rien : rien dans
 * l'application ne laisse deviner que c'est la case à cocher pendant la sortie qui la nourrit.
 */
function EmptyState() {
  return (
    <div className="mt-6 border-2 border-dashed border-ink-mute px-5 py-10">
      <p className="text-body text-ink-soft [text-wrap:pretty]">
        Coche une étape pendant ta sortie et le lieu se pose ici. Ta carte se remplit toute seule,
        sortie après sortie.
      </p>
    </div>
  );
}

function formatVisit(place: VisitedPlace): string {
  return formatShortDate(lastVisitTime(place));
}

/** « Aujourd'hui » tant que c'est le cas, sinon une date courte — plus lisible qu'un horodatage. */
function formatShortDate(time: number): string {
  if (!time || Number.isNaN(time)) return "";

  const date = new Date(time);
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (sameDay) return "aujourd'hui";

  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}
