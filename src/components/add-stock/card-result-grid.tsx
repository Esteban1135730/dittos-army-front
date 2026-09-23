import { useEffect, useState } from "react";

export type StockCardTile = {
  id: string;
  name: string;
  image: string;
  subtitle: string;
};

type CardResultGridProps = {
  cards: StockCardTile[];
  loading?: boolean;
  selectedId?: string;
  resetKey?: string;
  emptyWhenFiltered?: boolean;
  onSelect: (card: StockCardTile) => void;
};

const PAGE_SIZE = 12;

export function CardResultGrid({
  cards,
  loading,
  selectedId,
  resetKey,
  emptyWhenFiltered,
  onSelect,
}: CardResultGridProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  if (loading) {
    return <p className="text-gray-500 text-center">Cargando cartas...</p>;
  }
  if (cards.length === 0) {
    if (!emptyWhenFiltered) return null;
    return <p className="text-gray-500">No se encontraron cartas con ese nombre.</p>;
  }

  const totalPages = Math.ceil(cards.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const pageCards = cards.slice(start, start + PAGE_SIZE);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pageCards.map((card) => (
          <div
            key={`${card.id}-${card.subtitle}`}
            onClick={() => onSelect(card)}
            className={`bg-white rounded-lg shadow p-4 border flex flex-col cursor-pointer transition-all hover:shadow-lg ${
              selectedId === card.id
                ? "border-4 border-blue-500 shadow-lg"
                : "border-gray-200"
            }`}
          >
            <img src={card.image} alt={card.name} className="w-full h-40 object-contain mb-2" />
            <h3 className="text-lg font-semibold text-gray-800">
              {card.name}
              {card.subtitle ? ` - ${card.subtitle}` : ""}
            </h3>
          </div>
        ))}
      </div>
      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => {
              if (num === 1 || num === totalPages || (num >= page - 1 && num <= page + 1)) {
                return (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setPage(num)}
                    className={`px-3 py-2 border rounded-md ${
                      page === num
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {num}
                  </button>
                );
              }
              if (num === page - 2 || num === page + 2) {
                return (
                  <span key={num} className="px-2">
                    ...
                  </span>
                );
              }
              return null;
            })}
          </div>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>
      ) : null}
      <p className="text-sm text-gray-500 text-center mt-2">
        Mostrando {start + 1}-{Math.min(start + PAGE_SIZE, cards.length)} de {cards.length} cartas
      </p>
    </>
  );
}
