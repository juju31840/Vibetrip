"use client";

import { HomeScreen } from "@/components/HomeScreen";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { ResultScreen } from "@/components/ResultScreen";
import { useGenerateItinerary } from "@/hooks/useGenerateItinerary";

export default function Page() {
  const { state, generate, reset } = useGenerateItinerary();

  if (state.status === "loading") {
    return <LoadingState />;
  }

  if (state.status === "error") {
    return <ErrorState message={state.message} onRetry={reset} />;
  }

  if (state.status === "success") {
    return <ResultScreen itinerary={state.itinerary} onRestart={reset} />;
  }

  return <HomeScreen onGenerate={generate} />;
}
