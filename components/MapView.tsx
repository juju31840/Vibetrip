"use client";

import { useEffect, useRef } from "react";
import Map, { Marker, type MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { computeBounds } from "@/lib/geo";
import type { ItineraryStep, PlaceType } from "@/types/itinerary";

const TYPE_COLORS: Record<PlaceType, string> = {
  restaurant: "#F97316",
  bar: "#A855F7",
  cafe: "#D97706",
  museum: "#38BDF8",
  park: "#22C55E",
  viewpoint: "#38BDF8",
  activity: "#4F46E5",
  shopping: "#EC4899",
  nightlife: "#A855F7",
  hotel: "#F5F5F7",
  transport: "#9A9AA5",
  other: "#9A9AA5",
};

const DEFAULT_CENTER = { lat: 48.8566, lng: 2.3522 };

interface MapViewProps {
  steps: ItineraryStep[];
  activeStepId: string | null;
  onMarkerClick: (stepId: string) => void;
}

export function MapView({ steps, activeStepId, onMarkerClick }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);

  useEffect(() => {
    const bounds = computeBounds(steps);
    if (!bounds || !mapRef.current) return;
    mapRef.current.fitBounds(
      [
        [bounds.southwest.lng, bounds.southwest.lat],
        [bounds.northeast.lng, bounds.northeast.lat],
      ],
      { padding: 60, duration: 0 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  useEffect(() => {
    const activeStep = steps.find((step) => step.id === activeStepId);
    if (!activeStep || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [activeStep.location.lng, activeStep.location.lat],
      zoom: 14,
    });
  }, [activeStepId, steps]);

  const firstStep = steps[0];
  const initialCenter = firstStep?.location ?? DEFAULT_CENTER;

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{
        longitude: initialCenter.lng,
        latitude: initialCenter.lat,
        zoom: 12,
      }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      style={{ width: "100%", height: "100%" }}
    >
      {steps.map((step) => (
        <Marker
          key={step.id}
          longitude={step.location.lng}
          latitude={step.location.lat}
          onClick={(event) => {
            event.originalEvent.stopPropagation();
            onMarkerClick(step.id);
          }}
        >
          <span
            className="block h-3.5 w-3.5 rounded-full border-2 border-background"
            style={{
              backgroundColor: TYPE_COLORS[step.type],
              boxShadow:
                step.id === activeStepId ? "0 0 0 4px rgba(168, 85, 247, 0.5)" : undefined,
            }}
          />
        </Marker>
      ))}
    </Map>
  );
}
