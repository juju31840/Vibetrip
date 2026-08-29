"use client";

import { useCallback, useEffect, useState } from "react";
import { CoverScreen } from "@/components/CoverScreen";
import { HomeScreen, INITIAL_DRAFT, type HomeDraft } from "@/components/HomeScreen";
import { SavedScreen } from "@/components/SavedScreen";
import { ALL_ZONES, MyMapScreen } from "@/components/MyMapScreen";
import { ProposalsScreen } from "@/components/ProposalsScreen";
import { ProposalDetailScreen } from "@/components/ProposalDetailScreen";
import { BottomNav, type NavTab } from "@/components/BottomNav";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { ResultScreen } from "@/components/ResultScreen";
import { Toast } from "@/components/ui/Toast";
import { useGenerateItinerary } from "@/hooks/useGenerateItinerary";
import { noteVisit } from "@/lib/closed-places";
import { useSavedItineraries } from "@/hooks/useSavedItineraries";
import { useVisitedPlaces } from "@/hooks/useVisitedPlaces";
import type { SavedItinerary } from "@/lib/storage";
import type { Itinerary } from "@/types/itinerary";

/** Durée d'affichage de la confirmation : assez pour être lue, assez court pour ne pas gêner. */
const TOAST_MS = 2600;

export default function Page() {
  const { state, generate, reset } = useGenerateItinerary();
  const { saved, save, remove, toggleStepDone } = useSavedItineraries();
  const { places, recordVisit, forgetVisit } = useVisitedPlaces();

  /** Page de garde franchie — l'application proprement dite commence après. */
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState<NavTab>("create");
  /**
   * Les réglages en cours vivent ici, au-dessus de la coque à onglets, parce que celle-ci démonte
   * l'écran « Créer » dès qu'on va voir « Mes sorties » ou « Ma carte » : gardés dans l'écran, ils
   * repartaient de zéro à chaque aller-retour.
   */
  const [draft, setDraft] = useState<HomeDraft>(INITIAL_DRAFT);
  /**
   * Ville ouverte dans « Ma carte ». Ici et non dans l'écran, pour la même raison que les
   * réglages : ouvrir une sortie depuis la carte démonte la coque à onglets, et l'état gardé
   * dans l'écran renverrait sur la vue France au retour — on aurait à re-cliquer Lyon à chaque
   * aller-retour, alors qu'on ne l'a jamais quitté.
   */
  const [mapZone, setMapZone] = useState<string>(ALL_ZONES);
  /** Proposition ouverte en détail, avant validation. */
  const [openedProposal, setOpenedProposal] = useState<Itinerary | null>(null);
  /** Itinéraire de l'historique ouvert en plein écran. */
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // La confirmation s'efface seule. Le nettoyage du minuteur est indispensable : sans lui, deux
  // validations rapprochées laisseraient le premier minuteur masquer le second message.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  /**
   * L'enregistrement n'est pas automatique : il a lieu à la validation d'une proposition.
   * C'est un arbitrage — la sauvegarde automatique garantissait de ne rien perdre, mais elle
   * remplissait « Mes sorties » de tout ce qui avait été généré, y compris ce que
   * l'utilisateur n'avait pas retenu. Une liste qu'on n'a pas choisie n'est pas une liste.
   */
  const validateProposal = useCallback(
    (itinerary: Itinerary) => {
      const entry = save(itinerary);
      setOpenedProposal(null);
      reset();
      setOpenedId(entry.id);
      setTab("saved");
      // L'écran d'arrivée ressemble beaucoup à celui qu'on quitte : sans un mot, rien ne dit
      // que l'itinéraire a bien été rangé quelque part.
      setToast("Ajouté à tes sorties");
    },
    [save, reset]
  );

  /**
   * Cocher une étape fait deux choses : elle avance la sortie en cours *et* elle pose un point
   * sur la carte personnelle. Les deux magasins sont distincts à dessein — supprimer une sortie
   * de l'historique ne doit pas effacer les lieux où l'on est allé (lib/places-store.ts).
   *
   * La confirmation nomme le lieu ajouté : le geste se fait depuis la bottom sheet, alors que la
   * carte est dans un autre onglet. Sans un mot, on donnerait une information sans rien recevoir
   * en retour — c'est exactement ce qui manquait à la boucle.
   */
  const toggleStepVisited = useCallback(
    (entry: SavedItinerary, stepId: string) => {
      const step = entry.itinerary.steps.find((item) => item.id === stepId);
      const wasDone = entry.doneStepIds.includes(stepId);

      toggleStepDone(entry.id, stepId);
      if (!step) return;

      if (wasDone) {
        forgetVisit(entry.id, stepId);
      } else {
        recordVisit(entry.id, step);
        // Le même geste alimente le compteur collectif, sans attendre : c'est lui qui fera
        // remonter les bons lieux dans les propositions quand il y aura du monde.
        void noteVisit(step);
        setToast(`${step.placeName} — ajouté à ta carte`);
      }
    },
    [toggleStepDone, recordVisit, forgetVisit]
  );

  const backToTabs = useCallback(() => {
    setOpenedId(null);
    setOpenedProposal(null);
    reset();
  }, [reset]);

  const opened = saved.find((item) => item.id === openedId);

  function renderScreen() {
    if (!entered) {
      return <CoverScreen onStart={() => setEntered(true)} />;
    }

    if (opened) {
      return (
        <ResultScreen
          itinerary={opened.itinerary}
          doneStepIds={opened.doneStepIds}
          onToggleStepDone={(stepId) => toggleStepVisited(opened, stepId)}
          onBack={backToTabs}
        />
      );
    }

    if (state.status === "error") {
      return <ErrorState message={state.message} onRetry={backToTabs} />;
    }

    // L'écran de choix s'ouvre dès la première proposition arrivée, sans attendre les autres :
    // les générations sont parallèles, attendre la plus lente faisait payer le pire des trois
    // appels. L'écran d'attente ne sert donc plus qu'au temps où il n'y a encore rien à montrer.
    if (state.status === "loading" && state.itineraries.length === 0) {
      return <LoadingState />;
    }

    if (state.status === "loading" || state.status === "success") {
      const pending =
        state.status === "loading" ? Math.max(0, state.expected - state.itineraries.length) : 0;

      // Choix en deux temps : la liste pour décider d'une direction, le détail pour l'examiner
      // adresse par adresse, et la validation seulement là — pas avant d'avoir vu où l'on va.
      return openedProposal ? (
        <ProposalDetailScreen
          proposal={openedProposal}
          onValidate={validateProposal}
          onBack={() => setOpenedProposal(null)}
        />
      ) : (
        <ProposalsScreen
          proposals={state.itineraries}
          pending={pending}
          onOpen={setOpenedProposal}
          onBack={backToTabs}
        />
      );
    }

    // Coque à onglets : la barre reste en place d'un onglet à l'autre, c'est elle qui donne
    // à l'ensemble le comportement d'une application plutôt que d'une suite de pages.
    return (
      <main className="flex h-[100dvh] flex-col">
        {tab === "create" && (
          <HomeScreen draft={draft} onDraftChange={setDraft} onGenerate={generate} />
        )}
        {tab === "saved" && <SavedScreen items={saved} onOpen={setOpenedId} onRemove={remove} />}
        {/* « Ma carte » reçoit l'historique pour pouvoir rattacher les sorties à la ville
            ouverte, et `setOpenedId` pour les rouvrir : cliquer sur Lyon rend les points *et*
            les parcours qui les ont posés. `onOpenItinerary` est exactement ce que fait
            « Mes sorties » — même chemin de retour, on revient sur l'onglet d'où l'on vient. */}
        {tab === "map" && (
          <MyMapScreen
            places={places}
            saved={saved}
            zone={mapZone}
            onZoneChange={setMapZone}
            onOpenItinerary={setOpenedId}
          />
        )}
        <BottomNav
          active={tab}
          onSelect={setTab}
          badges={{ saved: saved.length, map: places.length }}
        />
      </main>
    );
  }

  return (
    <>
      {renderScreen()}
      {toast && <Toast message={toast} />}
    </>
  );
}
