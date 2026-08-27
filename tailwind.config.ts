import type { Config } from "tailwindcss";

/**
 * Design system VibeTrip — direction « Riso » (affiche sérigraphiée, deux encres).
 *
 * Remplace la direction « Carnet » (crème chaud + terracotta + serif), abandonnée pour une raison
 * précise et vérifiable : cette palette était, à quelques points près, celle de Claude
 * (#F0EEE6 / #CC785C). Ajoutés au serif de titrage, aux cartes blanches arrondies et à la faible
 * densité, ces traits forment la signature par défaut de l'interface générée — ce que des lecteurs
 * extérieurs ont reconnu au premier coup d'œil.
 *
 * Le registre est celui de l'affiche imprimée en risographie :
 * - un **papier journal gris-froid**, jamais un crème chaud ;
 * - **deux encres seulement**, saturées mais non fluorescentes (le rose fluo a été écarté à la
 *   demande de l'utilisateur), plus le noir d'impression et la couleur de surimpression ;
 * - **aucun angle arrondi, aucune ombre portée, aucune carte flottante** : des filets noirs épais
 *   et des aplats d'encre. C'est ce qui casse le plus nettement le gabarit précédent ;
 * - la **typographie fait l'image** : Anton en très grand pour les titres, Archivo pour le reste.
 *
 * Rôle des deux encres, à respecter :
 * - `accent` (vermillon) = l'action et la sélection. Jamais décoratif ;
 * - `blue` (outremer) = le factuel et le **confirmé** (lib/verify-places.ts). Une adresse
 *   vérifiée est une information calme, pas une alarme ;
 * - un lieu **non confirmé** ne reçoit aucune encre : c'est un conseil de prudence, pas une
 *   erreur, et la moitié des étapes en portent un. Le signaler en couleur ferait passer un
 *   produit qui fonctionne pour un produit cassé.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#E7E5DF",
        "paper-2": "#DBD9D2",
        "paper-3": "#CFCDC5",

        ink: "#17161A",
        "ink-soft": "#56545C",
        "ink-mute": "#84828B",

        accent: "#DD3B2E",
        "accent-deep": "#B32C21",
        blue: "#2B44A8",
        "blue-deep": "#1F3383",
        /** Là où les deux encres se superposent — réservé aux aplats croisés. */
        overprint: "#7A2E63",

        danger: "#B32C21",
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "Haettenschweiler", "sans-serif"],
        sans: ["var(--font-body)", "Helvetica Neue", "system-ui", "sans-serif"],
      },
      /**
       * Tout est carré. `card`, `sheet` et `pill` restent définis à 0 pour qu'une classe oubliée
       * quelque part rende un angle droit plutôt qu'un arrondi orphelin ; `pill` garde sa valeur
       * ronde pour les seuls marqueurs de carte, où le cercle est une convention cartographique.
       */
      borderRadius: {
        card: "0",
        sheet: "0",
        sm: "2px",
        pill: "9999px",
      },
      fontSize: {
        overline: ["0.625rem", { lineHeight: "0.9rem", letterSpacing: "0.2em", fontWeight: "700" }],
        caption: ["0.75rem", { lineHeight: "1.05rem" }],
        body: ["0.9375rem", { lineHeight: "1.35rem" }],
        title: ["1.0625rem", { lineHeight: "1.2rem", fontWeight: "700" }],
      },
      borderWidth: {
        // L'épaisseur de filet de l'affiche : 2 px partout, 3 px pour les séparations majeures.
        3: "3px",
      },
      spacing: {
        "safe-b": "env(safe-area-inset-bottom, 0px)",
      },
      boxShadow: {
        // Pas d'ombre diffuse : un décalage net, comme un aplat mal repéré à l'impression.
        print: "3px 3px 0 #17161A",
        card: "none",
        sheet: "none",
      },
      transitionDuration: {
        DEFAULT: "120ms",
      },
    },
  },
  plugins: [],
};

export default config;
