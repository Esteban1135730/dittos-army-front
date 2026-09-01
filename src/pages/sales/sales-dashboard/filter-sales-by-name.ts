export function filterSalesByName<T extends { stock_info?: { card_name?: string } }>(
  sales: T[],
  query: string,
): T[] {
  const termino = query.trim().toLowerCase();
  if (!termino) return sales;
  return sales.filter((sale) => {
    const nombre = (sale.stock_info?.card_name ?? "").toLowerCase();
    return nombre.includes(termino);
  });
}
