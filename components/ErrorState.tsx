import { Button } from "@/components/ui/Button";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <main className="flex h-[100dvh] flex-col justify-center gap-4 px-6">
      <span className="text-overline uppercase text-ink-soft">Erreur</span>
      <p className="font-display text-[3.25rem] uppercase leading-[0.85] tracking-[-0.02em] text-ink">
        Ça n&apos;a pas
        <br />
        marché
      </p>
      {/* Le message vient du serveur et est déjà rédigé pour être lu par un humain
          (app/api/generate-itinerary/route.ts) : on l'affiche tel quel. */}
      <p className="max-w-[20rem] border-l-2 border-accent pl-3 text-body text-ink-soft [text-wrap:pretty]">
        {message}
      </p>
      <Button variant="secondary" onClick={onRetry} className="mt-2 w-fit">
        Réessayer
      </Button>
    </main>
  );
}
