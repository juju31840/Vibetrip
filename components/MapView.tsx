"use client";

import clsx from "clsx";
import { useCallback, useEffect, useRef } from "react";
import Map, { Marker, type MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { computeBounds } from "@/lib/geo";
import type { MapPoint } from "@/types/itinerary";

/**
 * Les marqueurs ne sont pas colorés par type de lieu : douze couleurs sur une carte claire
 * produisaient un semis illisible, et le type d'un lieu se lit déjà sur sa fiche. Seule
 * distinction conservée — l'ordre de passage, qui est l'information utile sur un itinéraire.
 */
const MARKER_ACCENT = "#DD3B2E";
const MARKER_ACTIVE = "#2B44A8";

const DEFAULT_CENTER = { lat: 48.8566, lng: 2.3522 };

interface MapViewProps {
  points: MapPoint[];
  activeId: string | null;
  onMarkerClick: (id: string) => void;
  /**
   * Numérote les marqueurs dans l'ordre du parcours. Faux sur la carte personnelle : les lieux
   * visités sont une collection, pas un trajet — les numéroter y suggérerait un ordre qui
   * n'existe pas. Un point peut alors porter sa propre étiquette (`label`), sinon c'est un point.
   */
  numbered?: boolean;
  /** Zoom du survol d'un marqueur. Plus large sur la carte personnelle, dont les lieux sont dispersés. */
  focusZoom?: number;
}

export function MapView({
  points,
  activeId,
  onMarkerClick,
  numbered = true,
  focusZoom = 14,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);

  /**
   * Cadre la carte sur l'ensemble des points. Déclenché à la fois par `onLoad` et par le
   * changement de points : au montage, l'effet seul s'exécute avant que la carte ne soit
   * réellement prête et le `fitBounds` est alors perdu (tous les marqueurs restent hors
   * du cadre, la vue conservant l'`initialViewState`).
   */
  const fitToPoints = useCallback(() => {
    const bounds = computeBounds(points);
    if (!bounds || !mapRef.current) return;
    mapRef.current.fitBounds(
      [
        [bounds.southwest.lng, bounds.southwest.lat],
        [bounds.northeast.lng, bounds.northeast.lat],
      ],
      { padding: 60, duration: 0 }
    );
  }, [points]);

  useEffect(() => {
    fitToPoints();
  }, [fitToPoints]);

  useEffect(() => {
    const activePoint = points.find((point) => point.id === activeId);
    if (!activePoint || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [activePoint.location.lng, activePoint.location.lat],
      zoom: focusZoom,
    });
  }, [activeId, points, focusZoom]);

  const firstPoint = points[0];
  const initialCenter = firstPoint?.location ?? DEFAULT_CENTER;

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
      initialViewState={{
        longitude: initialCenter.lng,
        latitude: initialCenter.lat,
        zoom: 12,
      }}
      // Style clair : le fond papier de l'application jurerait avec une carte sombre.
      mapStyle="mapbox://styles/mapbox/light-v11"
      style={{ width: "100%", height: "100%" }}
      onLoad={fitToPoints}
    >
      {points.map((point, index) => {
        const isActive = point.id === activeId;
        const text = numbered ? String(index + 1) : point.label;
        return (
          <Marker
            key={point.id}
            longitude={point.location.lng}
            latitude={point.location.lat}
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              onMarkerClick(point.id);
            }}
          >
            <span
              aria-label={point.placeName}
              className={clsx(
                "flex cursor-pointer items-center justify-center rounded-pill border-2 border-ink font-bold text-paper",
                text ? "h-7 w-7 text-[0.75rem]" : "h-3.5 w-3.5",
                !text && isActive && "h-5 w-5"
              )}
              style={{
                backgroundColor: isActive ? MARKER_ACTIVE : MARKER_ACCENT,
                boxShadow: isActive ? "0 0 0 4px rgba(43, 68, 168, 0.25)" : "none",
              }}
            >
              {text ?? null}
            </span>
          </Marker>
        );
      })}
    </Map>
  );
}
