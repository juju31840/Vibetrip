import clsx from "clsx";

/**
 * L'étiquette cliquable du système — thèmes, villes de raccourci, onglets de ville de « Ma carte ».
 *
 * Elle vit ici parce qu'elle existait en **quatre métriques différentes** dans quatre fichiers :
 * deux tailles de corps (0,6875 et 0,75 rem), deux approches (0,06 et 0,08 em), deux gabarits de
 * marge — et surtout deux encres de sélection, le panneau « Changer » marquant en noir les mêmes
 * six thèmes que l'écran de réglages marque en vermillon. Écrites séparément, elles ne pouvaient
 * que diverger ; une définition unique est ce qui les empêche de recommencer.
 *
 * L'encre de sélection est le **vermillon**, comme le veut la règle du système : l'accent porte
 * l'action et la sélection. Le noir plein reste réservé au sélecteur de mode, qui n'est pas une
 * étiquette mais une bande jointive à choix unique et obligatoire — un objet différent, un
 * traitement différent.
 */
export function chipClass(active: boolean, extra?: string): string {
  return clsx(
    "border-2 border-ink px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] transition-colors",
    active ? "bg-accent text-paper" : "bg-transparent text-ink-soft hover:bg-paper-2 hover:text-ink",
    extra
  );
}
