import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary" | "ghost";

/**
 * Un rectangle cerné de noir, jamais une pilule. Le décalage d'ombre (`shadow-print`) imite un
 * aplat mal repéré à l'impression : c'est le seul relief du système, et il remplace l'ombre
 * diffuse qui faisait « carte flottante ».
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // L'action principale porte l'encre vermillon en aplat : sur un papier tramé, c'est elle qui
  // doit arrêter l'œil. Le noir reste pour le texte et les filets.
  primary: "border-2 border-ink bg-accent text-paper shadow-print disabled:opacity-35 disabled:shadow-none",
  secondary: "border-2 border-ink bg-transparent text-ink disabled:opacity-40",
  ghost: "bg-transparent text-ink-soft hover:text-ink",
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "px-6 py-3 text-body font-bold uppercase tracking-[0.08em] transition-colors active:translate-x-[1px] active:translate-y-[1px] disabled:cursor-not-allowed disabled:active:translate-x-0 disabled:active:translate-y-0",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}
