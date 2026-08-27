"use client";

import clsx from "clsx";
import { BookIcon, CompassIcon, HomeIcon } from "@/components/ui/icons";

export type NavTab = "create" | "saved" | "map";

const TABS: { value: NavTab; label: string; Icon: (props: { className?: string }) => JSX.Element }[] = [
  { value: "create", label: "Créer", Icon: HomeIcon },
  { value: "saved", label: "Sorties", Icon: BookIcon },
  { value: "map", label: "Ma carte", Icon: CompassIcon },
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
 * Trois onglets depuis que « Ma carte » existe. Le troisième onglet avait d'abord été retiré
 * parce qu'il n'aurait ouvert sur rien, et un onglet vide se remarque plus qu'un onglet absent ;
 * la carte des lieux visités lui donne une raison d'être, et son compteur qui monte fait partie
 * de la récompense.
 *
 * L'onglet actif est un aplat d'encre pleine hauteur, pas un pictogramme recoloré : dans un
 * système sans ombre ni arrondi, seul le contraste d'aplat distingue nettement.
 */
export function BottomNav({ active, onSelect, badges = {} }: BottomNavProps) {
  return (
    <nav className="grain grid shrink-0 grid-cols-3 border-t-3 border-ink pb-[max(1rem,env(safe-area-inset-bottom))]">
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
