import { transitOwnerFilterOptions, type TransitOwnerFilter } from "./transit-owner-filter";

type Props = {
  value: TransitOwnerFilter;
  onChange: (value: TransitOwnerFilter) => void;
};

export function TransitOwnerFilterBar({ value, onChange }: Props) {
  const options = transitOwnerFilterOptions();
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-sm text-gray-600">Dueño del lote:</span>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
            value === opt.value
              ? "bg-purple-700 text-white border-purple-700"
              : "bg-white text-gray-700 border-gray-300 hover:border-purple-400"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
