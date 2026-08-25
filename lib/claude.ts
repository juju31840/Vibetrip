import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { claudeItinerarySchema } from "./itinerary-schema";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";
import { buildMockItinerary } from "./mock-itinerary";
import type { GenerateItineraryRequest, Itinerary, ItineraryStep } from "@/types/itinerary";

const client = new Anthropic();

const MODEL = "claude-sonnet-5";
const MAX_TOKENS = 4096;

export class ItineraryParseError extends Error {}

async function requestItinerary(request: GenerateItineraryRequest, retry: boolean) {
  const systemPrompt = retry
    ? `${buildSystemPrompt()} Ta réponse précédente n'était pas un JSON valide conforme au schéma attendu. Corrige-la et renvoie uniquement le JSON demandé, sans aucun texte autour.`
    : buildSystemPrompt();

  return client.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    output_config: { format: zodOutputFormat(claudeItinerarySchema) },
    messages: [{ role: "user", content: buildUserPrompt(request) }],
  });
}

/**
 * Génère un itinéraire via Claude en structured output (schéma Zod contraint côté API).
 * Une erreur de parsing déclenche une unique tentative de retry avant d'abandonner.
 * Les erreurs de l'API Anthropic (rate limit, indisponibilité, etc.) remontent telles
 * quelles pour que l'appelant les distingue via `instanceof Anthropic.APIError`.
 */
export async function generateItinerary(request: GenerateItineraryRequest): Promise<Itinerary> {
  // Mock de développement (VIBETRIP_MOCK=1) : évite de consommer du crédit API pour
  // itérer sur la carte et la bottom sheet. Voir lib/mock-itinerary.ts.
  if (process.env.VIBETRIP_MOCK === "1") {
    return buildMockItinerary(request);
  }

  let response = await requestItinerary(request, false);

  if (!response.parsed_output) {
    response = await requestItinerary(request, true);
  }

  if (!response.parsed_output) {
    throw new ItineraryParseError(
      "Claude n'a pas retourné un itinéraire au format attendu après deux tentatives."
    );
  }

  const parsed = response.parsed_output;
  const steps: ItineraryStep[] = parsed.steps.map((step, index) => ({
    id: `step-${index + 1}`,
    ...step,
  }));

  return { ...parsed, steps };
}
