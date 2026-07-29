import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // font-semibold + text-shadow compensent le contraste insuffisant (~3.6:1) à
  // l'extrémité violette du dégradé, sans altérer la palette de marque.
  primary:
    "bg-brand-gradient text-text-primary [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] font-semibold shadow-lg shadow-black/30 disabled:opacity-40",
  secondary:
    "bg-transparent border border-border text-text-primary disabled:opacity-40",
  ghost: "bg-transparent text-text-secondary hover:text-text-primary",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "rounded-full px-6 py-3 text-sm font-medium transition-opacity active:opacity-80 disabled:cursor-not-allowed",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
