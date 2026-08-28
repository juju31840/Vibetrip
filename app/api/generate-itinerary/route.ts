import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateItineraryRequestSchema } from "@/lib/itinerary-schema";
import { generateProposals, ItineraryParseError } from "@/lib/claude";
import { checkRateLimit, MAX_PAR_ADRESSE } from "@/lib/rate-limit";
import { filterPlausibleSteps } from "@/lib/geo";
import { geocodeCity } from "@/lib/geocode";
import { verifySteps } from "@/lib/verify-places";
import type { ApiErrorResponse, GenerationEvent } from "@/types/itinerary";

// La génération la plus lourde (mode voyage) approche les 40 s : la valeur par défaut de la
// plateforme, 10 s, couperait la requête bien avant la fin.
export const maxDuration = 60;

function errorResponse(code: ApiErrorResponse["error"]["code"], message: string, status: number) {
  return NextResponse.json<ApiErrorResponse>({ error: { code, message } }, { status });
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return "unknown";
}

/**
 * Clé de quota : l'appareil d'abord, l'adresse ensuite.
 *
 * Compter par IP seule punit les gens qui partagent un réseau — trois amis sur le même wifi
 * saturaient un quota de quinze en cinq essais chacun, et c'est précisément la situation d'un
 * test entre proches. L'appareil envoie donc un identifiant tiré au sort et gardé dans son
 * navigateur.
 *
 * **Il est contournable, et ce n'est pas grave** : le quota protège une dépense, il ne garde pas
 * une porte. Quelqu'un qui vide son stockage repart à zéro — le garde-fou est ailleurs, dans le
 * plafond par adresse ci-dessous, qui lui ne bouge pas.
 */
function quotaKeys(request: NextRequest): { appareil: string; adresse: string } {
  const ip = getClientIp(request);
  const client = request.headers.get("x-vibetrip-client");
  // L'identifiant est repris tel quel mais borné : un en-tête vient du client, donc d'un
  // inconnu, et une clé de longueur arbitraire est une écriture arbitraire en base.
  const propre = client?.replace(/[^A-Za-z0-9-]/g, "").slice(0, 40);
  return { appareil: propre ? `${ip}:${propre}` : ip, adresse: `ip:${ip}` };
}

/**
 * Traduit une exception en couple code/message destiné à l'utilisateur.
 *
 * Extrait du `catch` de la route parce qu'une erreur peut désormais survenir *après* le début
 * du flux, où il est trop tard pour choisir un statut HTTP : elle part alors comme événement.
 */
function describeError(error: unknown): ApiErrorResponse["error"] {
  if (error instanceof ItineraryParseError) {
    return { code: "PARSE_ERROR", message: error.message };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { code: "TIMEOUT", message: "Le service de génération n'a pas répondu à temps." };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { code: "RATE_LIMITED", message: "Le service de génération est temporairement surchargé." };
  }
  if (error instanceof Anthropic.APIError) {
    return { code: "CLAUDE_ERROR", message: "Erreur lors de la génération de l'itinéraire." };
  }
  return { code: "CLAUDE_ERROR", message: "Erreur inattendue lors de la génération de l'itinéraire." };
}

export async function POST(request: NextRequest) {
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

  // Quota décompté seulement après validation : le but est de limiter les appels payants à
  // Claude, pas les requêtes malformées. Le compter avant laisserait un bug côté client
  // épuiser le quota d'un utilisateur pour une heure sans qu'aucune génération ait eu lieu.
  // Deux compteurs : un par appareil au quota courant, un par adresse quatre fois plus large.
  // Le premier laisse vivre un groupe d'amis derrière une même box ; le second empêche qu'on
  // contourne indéfiniment en renouvelant son identifiant.
  const { appareil, adresse } = quotaKeys(request);
  const [parAppareil, parAdresse] = await Promise.all([
    checkRateLimit(appareil),
    checkRateLimit(adresse, MAX_PAR_ADRESSE),
  ]);
  const rateLimit = parAppareil.allowed ? parAdresse : parAppareil;
  if (!rateLimit.allowed) {
    return errorResponse(
      "RATE_LIMITED",
      "Tu as atteint la limite de générations pour cette heure. Réessaie plus tard.",
      429
    );
  }

  // Les deux erreurs ci-dessus sont les seules à pouvoir porter un statut HTTP : dès que le flux
  // commence, la réponse est un 200 et tout le reste passe par un événement `error`.

  const { location, distance } = parsedRequest.data;

  // Lancé avant les générations, pas à l'intérieur : le géocodage de la ville ne dépend pas du
  // modèle, autant qu'il se fasse pendant que celui-ci écrit. `geocodeCity` ne rejette jamais.
  const referencePointPromise =
    "lat" in location ? Promise.resolve(location) : geocodeCity(location.city);

  const tasks = generateProposals(parsedRequest.data);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let open = true;

      const send = (event: GenerationEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // Le client est parti (retour arrière, onglet fermé). Rien à signaler : les
          // générations en cours se termineront dans le vide, elles sont déjà payées.
          open = false;
        }
      };

      const startedAt = Date.now();
      send({ type: "start", expected: tasks.length });

      let delivered = 0;
      let implausible = 0;
      const failures: unknown[] = [];

      await Promise.all(
        tasks.map(async (task) => {
          try {
            const proposal = await task;
            const referencePoint = await referencePointPromise;

            const plausibleSteps = referencePoint
              ? filterPlausibleSteps(proposal.steps, referencePoint, proposal.mode, distance)
              : proposal.steps;
            // Une proposition dont toutes les étapes sont aberrantes est écartée sans faire
            // échouer les autres.
            if (plausibleSteps.length === 0) {
              implausible += 1;
              return;
            }

            // Confrontation au référentiel de lieux : le filtre de plausibilité ci-dessus
            // n'écarte que les coordonnées aberrantes, pas les lieux inventés ou fermés
            // (lib/verify-places.ts). Les étapes non vérifiées sont conservées mais marquées :
            // les supprimer viderait des itinéraires entiers.
            const steps = await verifySteps(plausibleSteps);

            send({ type: "proposal", itinerary: { ...proposal, steps } });
            delivered += 1;
            console.log(`[timing] ${proposal.id} livrée à ${Date.now() - startedAt} ms`);
          } catch (error) {
            // Log serveur : les messages renvoyés au client sont volontairement génériques,
            // sans trace ici le diagnostic est impossible (cause réelle invisible).
            console.error("[generate-itinerary]", error);
            failures.push(error);
          }
        })
      );

      // Une seule proposition livrée suffit à faire un écran utile : on ne signale une erreur
      // que si le compte est à zéro.
      if (delivered === 0) {
        const noneWasPlausible = implausible > 0 && failures.length === 0;
        send({
          type: "error",
          error: noneWasPlausible
            ? {
                code: "IMPLAUSIBLE_LOCATIONS",
                message:
                  "Aucune proposition n'a de coordonnées plausibles pour cette position. Réessaie, ou élargis le curseur Distance.",
              }
            : describeError(failures[0]),
        });
      }

      open = false;
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Sans cet en-tête, un proxy ou un CDN peut mettre le flux en tampon et le livrer d'un
      // bloc à la fin — ce qui annulerait exactement le bénéfice recherché.
      "X-Accel-Buffering": "no",
    },
  });
}
