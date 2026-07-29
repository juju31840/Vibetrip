"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { LocationInput as LocationValue } from "@/types/itinerary";

interface LocationInputProps {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
}

export function LocationInput({ value, onChange }: LocationInputProps) {
  const [status, setStatus] = useState<"idle" | "locating" | "denied">("idle");
  const [city, setCity] = useState("");

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setStatus("denied");
      return;
    }

    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus("idle");
      },
      () => {
        setStatus("denied");
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  function handleCityChange(next: string) {
    setCity(next);
    onChange(next.trim() ? { city: next.trim() } : null);
  }

  const hasGeoLocation = value !== null && "lat" in value;

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant={hasGeoLocation ? "primary" : "secondary"}
        onClick={useMyLocation}
        disabled={status === "locating"}
      >
        {status === "locating"
          ? "Localisation..."
          : hasGeoLocation
            ? "Position détectée"
            : "Utiliser ma position"}
      </Button>

      {(status === "denied" || !hasGeoLocation) && (
        <input
          type="text"
          placeholder="Ou entre une ville de départ"
          value={city}
          onChange={(event) => handleCityChange(event.target.value)}
          className="rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text-primary placeholder:text-text-secondary"
        />
      )}
    </div>
  );
}
