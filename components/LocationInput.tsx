"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { chipClass } from "@/components/ui/chip";
import { PinIcon } from "@/components/ui/icons";
import { SUGGESTED_CITIES, matchCities } from "@/lib/cities";
import type { LocationInput as LocationValue } from "@/types/itinerary";

interface LocationInputProps {
  value: LocationValue | null;
  /**
   * Texte saisi, remonté avec la valeur. Il ne se déduit pas de `value`, qui vaut null tant que
   * la saisie ne fait pas une ville : sans lui, taper une lettre puis l'effacer effacerait aussi
   * ce qu'on est en train d'écrire. Il est conservé dans `HomeDraft` pour survivre au changement
   * d'onglet, qui démonte cet écran.
   */
  cityText: string;
  onChange: (next: { value: LocationValue | null; cityText: string }) => void;
}

type GeoStatus = "idle" | "locating" | "denied" | "unavailable" | "insecure";

export function LocationInput({ value, cityText, onChange }: LocationInputProps) {
  const [status, setStatus] = useState<GeoStatus>("idle");

  const suggestions = useMemo(() => matchCities(cityText), [cityText]);
  const hasGeoLocation = value !== null && "lat" in value;

  function useMyLocation() {
    // Les navigateurs réservent la géolocalisation aux « contextes sécurisés » : https, ou
    // localhost. Sur une adresse de réseau local en http — le cas quand on teste depuis son
    // téléphone — l'API est soit absente, soit refusée sans jamais demander la permission.
    // Le dire explicitement évite de laisser croire à un refus de l'utilisateur.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setStatus("insecure");
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }

    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          value: { lat: position.coords.latitude, lng: position.coords.longitude },
          cityText: "",
        });
        setStatus("idle");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  function selectCity(next: string) {
    onChange({ value: next.trim() ? { city: next.trim() } : null, cityText: next });
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant={hasGeoLocation ? "primary" : "secondary"}
        onClick={useMyLocation}
        disabled={status === "locating"}
        className="flex items-center justify-center gap-2"
      >
        <PinIcon className="h-[18px] w-[18px]" />
        {status === "locating"
          ? "Localisation…"
          : hasGeoLocation
            ? "Position détectée"
            : "Utiliser ma position"}
      </Button>

      {status !== "idle" && status !== "locating" && !hasGeoLocation && (
        <p className="border-l-2 border-accent pl-2.5 text-caption text-ink-soft">{GEO_MESSAGES[status]}</p>
      )}

      {!hasGeoLocation && (
        <>
          <input
            type="text"
            inputMode="text"
            autoComplete="off"
            placeholder="Ou entre une ville de départ"
            value={cityText}
            onChange={(event) => selectCity(event.target.value)}
            className="border-2 border-ink bg-transparent px-3.5 py-3 text-base text-ink placeholder:text-ink-mute focus:border-accent focus:outline-none"
          />

          {/* Propositions : un raccourci, jamais une restriction — n'importe quelle commune que
              le géocodage sait résoudre fonctionne, et la saisie reste libre. */}
          <CityChips
            cities={suggestions.length > 0 ? suggestions : SUGGESTED_CITIES}
            selected={cityText.trim()}
            onSelect={selectCity}
          />
        </>
      )}
    </div>
  );
}

const GEO_MESSAGES: Record<Exclude<GeoStatus, "idle" | "locating">, string> = {
  denied: "Position refusée. Choisis une ville ci-dessous.",
  unavailable: "Ton navigateur ne sait pas te localiser. Choisis une ville ci-dessous.",
  insecure:
    "La localisation exige une connexion sécurisée (https), impossible sur un serveur de test en réseau local. Choisis une ville ci-dessous.",
};

function CityChips({
  cities,
  selected,
  onSelect,
}: {
  cities: readonly string[];
  selected: string;
  onSelect: (city: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {cities.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onSelect(name)}
          className={chipClass(selected.toLowerCase() === name.toLowerCase())}
        >
          {name}
        </button>
      ))}
    </div>
  );
}
