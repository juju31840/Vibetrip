"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ApiErrorResponse,
  GenerateItineraryRequest,
  GenerationEvent,
  Itinerary,
} from "@/types/itinerary";

/**
 * `loading` porte désormais les propositions **déjà arrivées** : l'écran de choix s'affiche dès
 * la première, les suivantes s'y ajoutent. `expected` sert à annoncer combien il en reste, pour
 * que l'attente restante soit lisible plutôt que muette.
 */
type GenerationState =
  | { status: "idle" }
  | { status: "loading"; itineraries: Itinerary[]; expected: number }
  | { status: "success"; itineraries: Itinerary[] }
  | { status: "error"; message: string };

export function useGenerateItinerary() {
  const [state, setState] = useState<GenerationState>({ status: "idle" });

  /**
   * Une génération abandonnée (retour arrière, relance) ne doit plus écrire dans l'état : le
   * flux d'une requête précédente arriverait sinon par-dessus l'écran courant. Le compteur
   * identifie la requête en cours, le contrôleur interrompt la lecture du flux abandonné.
   */
  const requestId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (request: GenerateItineraryRequest) => {
    const id = ++requestId.current;
    const isCurrent = () => requestId.current === id;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ status: "loading", itineraries: [], expected: 0 });

    try {
      const response = await fetch("/api/generate-itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      // Erreur survenue avant le flux (paramètres invalides, quota) : réponse JSON classique
      // avec un vrai statut HTTP. Tout ce qui casse ensuite arrive en événement `error`.
      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => null)) as ApiErrorResponse | null;
        if (isCurrent()) {
          setState({ status: "error", message: data?.error.message ?? "Erreur inattendue." });
        }
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const received: Itinerary[] = [];
      let buffer = "";
      let expected = 0;
      let failed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Une ligne peut arriver en deux morceaux : ce qui suit le dernier saut de ligne est
        // gardé pour le tour suivant, sans quoi un JSON coupé en deux ferait perdre une
        // proposition entière.
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          let event: GenerationEvent;
          try {
            event = JSON.parse(line) as GenerationEvent;
          } catch {
            continue;
          }

          if (!isCurrent()) return;

          if (event.type === "start") {
            expected = event.expected;
            setState({ status: "loading", itineraries: [...received], expected });
          } else if (event.type === "proposal") {
            received.push(event.itinerary);
            setState({ status: "loading", itineraries: [...received], expected });
          } else {
            failed = true;
            setState({ status: "error", message: event.error.message });
          }
        }
      }

      if (!isCurrent() || failed) return;

      if (received.length === 0) {
        setState({ status: "error", message: "La génération n'a rien renvoyé. Réessaie." });
        return;
      }

      setState({ status: "success", itineraries: received });
    } catch {
      // Inclut l'interruption volontaire : le garde ci-dessous évite d'afficher une erreur
      // pour une requête que l'utilisateur a lui-même abandonnée.
      if (isCurrent()) {
        setState({ status: "error", message: "Impossible de contacter le serveur." });
      }
    }
  }, []);

  const reset = useCallback(() => {
    requestId.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setState({ status: "idle" });
  }, []);

  return { state, generate, reset };
}
