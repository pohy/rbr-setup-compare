type Props = {
  carNames: string[];
  selectedCar: string | null;
  onSelect: (carName: string) => void;
};

export function CarPicker({ carNames, selectedCar, onSelect }: Props) {
  return (
    <div className="flex items-center gap-2 px-4 py-1.5 bg-accent/5 border-b border-accent/30 text-xs">
      <span className="text-text-secondary">Car for range constraints:</span>
      <select
        className="bg-surface border border-border rounded px-2 py-0.5 text-text-primary text-xs cursor-pointer"
        value={selectedCar ?? ""}
        onChange={(e) => {
          if (e.target.value) onSelect(e.target.value);
        }}
      >
        <option value="" disabled>
          Pick car…
        </option>
        {carNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}
