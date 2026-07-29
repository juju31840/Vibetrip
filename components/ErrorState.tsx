import { Button } from "@/components/ui/Button";

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm text-text-secondary">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Réessayer
      </Button>
    </main>
  );
}
