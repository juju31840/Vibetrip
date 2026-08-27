import type { Metadata, Viewport } from "next";
import { Anton, Archivo } from "next/font/google";
import "./globals.css";

// Anton en titrage : une grasse condensée d'affiche, posée en très grand, qui fait l'image à
// elle seule. Archivo pour tout le reste — une grotesque neutre et lisible en petit, qui laisse
// le titrage porter la personnalité au lieu de lui disputer l'attention.
const display = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const body = Archivo({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "VibeTrip",
  description: "Ton budget, ton humeur, ta distance. On s'occupe du programme.",
  // `app/icon.svg` est repris automatiquement par Next ; le déclarer ici sert l'écran d'accueil
  // iOS, qui ignore le SVG et prenait jusqu'ici un rendu par défaut du navigateur.
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

// Pas de maximumScale : bloquer le pinch-zoom casse l'accessibilité (WCAG 1.4.4).
// L'auto-zoom iOS au focus est évité en gardant les champs de saisie à 16px (text-base).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#E7E5DF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body
        // `min-h-[100dvh]` et non `min-h-screen` (= 100vh). C'est ce qui rendait la flèche de
        // retour inatteignable sur téléphone : `100vh` compte la zone recouverte par la barre
        // d'adresse, le corps de page était donc plus haut que la zone visible, la page devenait
        // scrollable, et l'en-tête de l'écran de résultat — posé en absolu, pas en fixe —
        // disparaissait sous cette barre au moindre défilement. Le reste de l'app était déjà
        // passé en `dvh` ; le corps de page avait été oublié.
        className={`${display.variable} ${body.variable} min-h-[100dvh] bg-paper font-sans text-ink antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
