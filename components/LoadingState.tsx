export function LoadingState() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-transparent" />
      <p className="text-sm text-text-secondary">Génération de ton itinéraire...</p>
    </main>
  );
}
