export type ExpansionOption = {
  id: string;
  label: string;
};

type ExpansionSearchProps = {
  value: string;
  onChange: (value: string) => void;
  open: boolean;
  onOpen: () => void;
  loading?: boolean;
  items: ExpansionOption[];
  onPick: (item: ExpansionOption) => void;
};

export function ExpansionSearch({
  value,
  onChange,
  open,
  onOpen,
  loading,
  items,
  onPick,
}: ExpansionSearchProps) {
  return (
    <div className="mb-6 relative">
      <label className="block mb-2 text-sm font-medium text-gray-700">
        Buscar expansión
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onOpen}
        placeholder="Nombre o código de la expansión..."
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {open ? (
        <ul className="absolute z-10 bg-white w-full border border-gray-200 max-h-60 overflow-y-auto rounded-lg shadow mt-1">
          {items.length > 0 ? (
            items.map((item) => (
              <li
                key={item.id}
                onClick={() => onPick(item)}
                className="px-4 py-2 cursor-pointer hover:bg-blue-100"
              >
                {item.label}
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-gray-500">No se encontraron expansiones.</li>
          )}
        </ul>
      ) : null}
      {loading ? <p className="text-sm text-gray-500 mt-2">Cargando expansiones...</p> : null}
    </div>
  );
}
