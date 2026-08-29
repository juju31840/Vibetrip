"use client";

import { useCallback, useEffect, useState } from "react";
import { CoverScreen } from "@/components/CoverScreen";
import { HomeScreen, INITIAL_DRAFT, type HomeDraft } from "@/components/HomeScreen";
import { SavedScreen } from "@/components/SavedScreen";
import { ALL_ZONES, MyMapScreen } from "@/components/MyMapScreen";
import { ProfileScreen } from "@/components/ProfileScreen";
import { ProposalsScreen } from "@/components/ProposalsScreen";
import { ProposalDetailScreen } from "@/components/ProposalDetailScreen";
import { BottomNav, type NavTab } from "@/components/BottomNav";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { ResultScreen } from "@/components/ResultScreen";
import { Toast } from "@/components/ui/Toast";
import { useGenerateItinerary } from "@/hooks/useGenerateItinerary";
import { ecrireIdentite, lireIdentite, IDENTITE_VIDE, type Identity } from "@/lib/identity";
import {
  ecrirePreferences,
  lirePreferences,
  preferencesUtiles,
  type Preferences,
} from "@/lib/preferences";
import { noteVisit, rateStep } from "@/lib/closed-places";
import { marquerNote } from "@/lib/ratings-store";
import { useSavedItineraries } from "@/hooks/useSavedItineraries";
import { useVisitedPlaces } from "@/hooks/useVisitedPlaces";
import type { SavedItinerary } from "@/lib/storage";
import type { Itinerary, ItineraryStep, ThemeId } from "@/types/itinerary";

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
  /** Incrémenté quand le profil dépose des envies : l'écran de réglages y fait alors défiler. */
  const [revealThemes, setRevealThemes] = useState(0);
  /**
   * Préférences déclarées. Lues après le montage et non à l'initialisation : `localStorage`
   * n'existe pas au rendu serveur, et une valeur initiale différente entre serveur et client
   * casserait l'hydratation.
   */
  const [preferences, setPreferences] = useState<Preferences | null>(null);

  const [identity, setIdentity] = useState<Identity>(IDENTITE_VIDE);

  useEffect(() => {
    setPreferences(lirePreferences());
    setIdentity(lireIdentite());
  }, []);

  const saveIdentity = useCallback((next: Identity) => {
    setIdentity(next);
    // Un refus du stockage ne doit pas rester muet : la photo resterait à l'écran, portée par
    // l'état, et disparaîtrait au rechargement suivant sans que rien ne l'ait annoncé.
    if (!ecrireIdentite(next)) {
      setToast("Stockage plein — la photo n'a pas pu être gardée");
    }
  }, []);

  const savePreferences = useCallback((prefs: Preferences) => {
    setPreferences(prefs);
    ecrirePreferences(prefs);
  }, []);
  /** Proposition ouverte en détail, avant validation. */
  const [openedProposal, setOpenedProposal] = useState<Itinerary | null>(null);
  /** Itinéraire de l'historique ouvert en plein écran. */
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /**
   * Le lieu qu'on vient de cocher, pour que la confirmation puisse en demander une note. C'est
   * le seul moment où la question tombe juste : on vient de dire qu'on y était.
   */
  const [aNoter, setANoter] = useState<{ itineraryId: string; step: ItineraryStep } | null>(null);

  // La confirmation s'efface seule. Le nettoyage du minuteur est indispensable : sans lui, deux
  // validations rapprochées laisseraient le premier minuteur masquer le second message.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
      setANoter(null);
    }, TOAST_MS);
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
        setANoter({ itineraryId: entry.id, step });
      }
    },
    [toggleStepDone, recordVisit, forgetVisit]
  );

  /**
   * Le seul geste du profil, et sa raison d'être : les habitudes observées deviennent les envies
   * du prochain réglage. Sans lui, l'écran serait un miroir — or un miroir n'a jamais amélioré
   * une soirée, et c'est très exactement la réserve qui avait tenu cet onglet fermé si longtemps.
   *
   * Il **dépose** les envies dans les réglages au lieu de les appliquer en sous-main, et bascule
   * sur « Créer » pour qu'on les voie cochées. Un profil qui infléchirait les propositions sans
   * le montrer serait pire qu'un profil décoratif : on ne saurait plus pourquoi on obtient ça.
   */
  const applyTastes = useCallback((themes: ThemeId[]) => {
    setDraft((current) => ({ ...current, themes }));
    setTab("create");
    // Le compteur, et non un booléen : appliquer deux fois de suite doit ramener la section à la
    // vue les deux fois, or un drapeau déjà à `true` ne redéclencherait aucun effet.
    setRevealThemes((n) => n + 1);
    setToast("Tes envies sont réglées");
  }, []);

  /**
   * Changer d'onglet à la main désarme le renvoi vers les envies. Sans cela le drapeau restait
   * levé, et l'écran de réglages faisait défiler jusqu'aux envies à **chaque** retour sur
   * « Créer » — un mouvement qu'on n'a demandé qu'une fois.
   */
  const selectTab = useCallback((next: NavTab) => {
    setRevealThemes(0);
    setTab(next);
  }, []);

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
          <HomeScreen
            key={revealThemes}
            draft={draft}
            onDraftChange={setDraft}
            onGenerate={generate}
            revealThemes={revealThemes > 0}
            preferences={preferencesUtiles(preferences) ? preferences : null}
            preferredCities={preferences?.cities ?? []}
          />
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
        {tab === "profile" && (
          <ProfileScreen
            places={places}
            themes={draft.themes}
            onApply={applyTastes}
            preferences={preferences}
            onPreferencesChange={savePreferences}
            identity={identity}
            onIdentityChange={saveIdentity}
          />
        )}
        <BottomNav
          active={tab}
          onSelect={selectTab}
          badges={{ saved: saved.length, map: places.length }}
        />
      </main>
    );
  }

  return (
    <>
      {renderScreen()}
      {toast && (
        <Toast
          message={toast}
          onRate={
            aNoter
              ? (note) => {
                  void rateStep(aNoter.step, note);
                  // Mémorisé localement, sans quoi « Mes sorties » redemanderait le même avis :
                  // la base ne retient aucun registre de qui a noté quoi.
                  marquerNote(aNoter.itineraryId, aNoter.step.id, aNoter.step.placeName, note);
                  // La question posée a reçu sa réponse : on remercie et on s'efface.
                  setToast("Merci, c'est noté");
                  setANoter(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
