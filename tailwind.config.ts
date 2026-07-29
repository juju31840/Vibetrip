import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0B0B12",
        surface: "#15151C",
        "surface-alt": "#1E1E27",
        border: "#2A2A35",
        "text-primary": "#F5F5F7",
        "text-secondary": "#9A9AA5",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(90deg, #4F46E5 0%, #A855F7 100%)",
      },
      borderRadius: {
        sheet: "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
