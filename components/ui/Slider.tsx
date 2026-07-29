interface SliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function Slider({ label, value, onChange, min = 0, max = 100 }: SliderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm text-text-secondary">
        <span>{label}</span>
        <span className="text-text-primary">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full appearance-none rounded-full bg-surface-alt accent-[#A855F7]"
      />
    </div>
  );
}
