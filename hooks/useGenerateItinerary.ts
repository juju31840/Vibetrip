"use client";

import { useCallback, useState } from "react";
import type {
  ApiErrorResponse,
  GenerateItineraryRequest,
  GenerateItineraryResponse,
  Itinerary,
} from "@/types/itinerary";

type GenerationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; itinerary: Itinerary }
  | { status: "error"; message: string };

export function useGenerateItinerary() {
  const [state, setState] = useState<GenerationState>({ status: "idle" });

  const generate = useCallback(async (request: GenerateItineraryRequest) => {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });

      const data = (await response.json()) as GenerateItineraryResponse | ApiErrorResponse;

      if (!response.ok || "error" in data) {
        const message = "error" in data ? data.error.message : "Erreur inattendue.";
        setState({ status: "error", message });
        return;
      }

      setState({ status: "success", itinerary: data.itinerary });
    } catch {
      setState({ status: "error", message: "Impossible de contacter le serveur." });
    }
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, generate, reset };
}
