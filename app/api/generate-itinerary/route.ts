import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateItineraryRequestSchema } from "@/lib/itinerary-schema";
import { generateItinerary, ItineraryParseError } from "@/lib/claude";
import { checkRateLimit } from "@/lib/rate-limit";
import { filterPlausibleSteps } from "@/lib/geo";
import type { ApiErrorResponse, GenerateItineraryResponse } from "@/types/itinerary";

function errorResponse(code: ApiErrorResponse["error"]["code"], message: string, status: number) {
  return NextResponse.json<ApiErrorResponse>({ error: { code, message } }, { status });
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return "unknown";
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(getClientIp(request));
  if (!rateLimit.allowed) {
    return errorResponse(
      "RATE_LIMITED",
      "Trop de générations récentes, réessaie dans un instant.",
      429
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_INPUT", "Corps de requête JSON invalide.", 400);
  }

  const parsedRequest = generateItineraryRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return errorResponse("INVALID_INPUT", "Les paramètres envoyés sont invalides.", 400);
  }

  try {
    const itinerary = await generateItinerary(parsedRequest.data);

    const { location, distance } = parsedRequest.data;
    const referencePoint = "lat" in location ? location : null;
    const steps = referencePoint
      ? filterPlausibleSteps(itinerary.steps, referencePoint, itinerary.mode, distance)
      : itinerary.steps;

    if (steps.length === 0) {
      return errorResponse(
        "IMPLAUSIBLE_LOCATIONS",
        "Claude n'a pas retourné d'étape avec des coordonnées plausibles pour cette position. Réessaie, ou élargis le curseur Distance.",
        502
      );
    }

    const response: GenerateItineraryResponse = { itinerary: { ...itinerary, steps } };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ItineraryParseError) {
      return errorResponse("PARSE_ERROR", error.message, 502);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return errorResponse(
        "TIMEOUT",
        "Le service de génération n'a pas répondu à temps.",
        504
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return errorResponse(
        "RATE_LIMITED",
        "Le service de génération est temporairement surchargé.",
        429
      );
    }
    if (error instanceof Anthropic.APIError) {
      return errorResponse(
        "CLAUDE_ERROR",
        "Erreur lors de la génération de l'itinéraire.",
        502
      );
    }
    return errorResponse(
      "CLAUDE_ERROR",
      "Erreur inattendue lors de la génération de l'itinéraire.",
      502
    );
  }
}
