"use client";

import clsx from "clsx";
import { BookIcon, CompassIcon, HomeIcon, UserIcon } from "@/components/ui/icons";

export type NavTab = "create" | "saved" | "map" | "profile";

const TABS: { value: NavTab; label: string; Icon: (props: { className?: string }) => JSX.Element }[] = [
  { value: "create", label: "Créer", Icon: HomeIcon },
  { value: "saved", label: "Sorties", Icon: BookIcon },
  { value: "map", label: "Ma carte", Icon: CompassIcon },
  { value: "profile", label: "Profil", Icon: UserIcon },
];

interface BottomNavProps {
  active: NavTab;
  onSelect: (tab: NavTab) => void;
  /** Compteurs affichés en pastille, par onglet. */
  badges?: Partial<Record<NavTab, number>>;
}

/**
 * Barre de navigation persistante — c'est elle qui fait qu'une page web se lit comme une
 * application.
 *
 * Quatre onglets. Chacun a attendu d'avoir quelque chose à montrer avant d'apparaître : un
 * onglet vide se remarque plus qu'un onglet absent. « Ma carte » est arrivée quand cocher une
 * étape a enfin posé un point quelque part ; « Profil » quand ces points ont été assez nombreux
 * pour dire quelque chose de vrai — et surtout pour **changer** les propositions suivantes.
 *
 * À quatre, chaque colonne fait 80 px sur le plus étroit des téléphones (320 px). Les libellés
 * ont été choisis pour y tenir : « Profil » et non « Mon profil », « Sorties » et non
 * « Mes sorties » — c'est aussi pour cela que le troisième s'appelle « Ma carte », le seul dont
 * le possessif était déjà nécessaire pour le distinguer de la carte d'un itinéraire.
 *
 * L'onglet actif est un aplat d'encre pleine hauteur, pas un pictogramme recoloré : dans un
 * système sans ombre ni arrondi, seul le contraste d'aplat distingue nettement.
 */
export function BottomNav({ active, onSelect, badges = {} }: BottomNavProps) {
  return (
    <nav className="grain grid shrink-0 grid-cols-4 border-t-3 border-ink pb-[max(1rem,env(safe-area-inset-bottom))]">
      {TABS.map(({ value, label, Icon }, index) => {
        const isActive = active === value;
        const badge = badges[value] ?? 0;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(value)}
            aria-current={isActive ? "page" : undefined}
            className={clsx(
              "flex flex-col items-center gap-1 pb-2 pt-2.5 transition-colors",
              index > 0 && "border-l-2 border-ink",
              isActive ? "bg-ink text-paper" : "text-ink-soft hover:bg-paper-2"
            )}
          >
            <span className="relative">
              <Icon className="h-[21px] w-[21px]" />
              {badge > 0 && (
                <span
                  className={clsx(
                    "absolute -right-3 -top-1.5 min-w-[1.05rem] px-1 text-center text-[0.625rem] font-bold leading-[1.05rem]",
                    isActive ? "bg-paper text-ink" : "bg-accent text-paper"
                  )}
                >
                  {badge}
                </span>
              )}
            </span>
            <span className="text-[0.625rem] font-bold uppercase tracking-[0.14em]">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
