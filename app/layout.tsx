import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VibeTrip",
  description: "Choisis ta vibe, l'IA construit ton itinéraire.",
};

// Pas de maximumScale : bloquer le pinch-zoom casse l'accessibilité (WCAG 1.4.4).
// L'auto-zoom iOS au focus est évité en gardant les champs de saisie à 16px (text-base).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B0B12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${manrope.className} min-h-screen bg-background antialiased`}>
        {children}
      </body>
    </html>
  );
}
