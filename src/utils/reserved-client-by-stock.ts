export type ReservedClientRef = {
  clientId: string;
  nombre: string;
};

type ReservaLike = {
  stock_id?: string;
  client_id?: string;
};

type ClientLike = {
  _id?: string;
  nombre?: string;
};

/** stock_id → cliente de la reserva (una reserva por línea de stock). */
export function mapReservedClientByStockId(
  reservas: ReadonlyArray<ReservaLike>,
  clients: ReadonlyArray<ClientLike>,
): Map<string, ReservedClientRef> {
  const nameByClientId = new Map<string, string>();
  for (const client of clients) {
    const clientId = String(client._id ?? "").trim();
    if (!clientId) continue;
    const nombre = String(client.nombre ?? "").trim() || "Cliente";
    nameByClientId.set(clientId, nombre);
  }

  const byStock = new Map<string, ReservedClientRef>();
  for (const reserva of reservas) {
    const stockId = String(reserva.stock_id ?? "").trim();
    const clientId = String(reserva.client_id ?? "").trim();
    if (!stockId || !clientId || byStock.has(stockId)) continue;
    byStock.set(stockId, {
      clientId,
      nombre: nameByClientId.get(clientId) ?? "Cliente",
    });
  }
  return byStock;
}

export function stockReservationStateLabel(
  cardState: string,
  reserved: ReservedClientRef | undefined,
): string {
  if (cardState === "propiedad") return "En propiedad";
  if (cardState === "vendida") return "Vendida";
  if (cardState === "reserva") {
    const nombre = reserved?.nombre?.trim();
    return nombre ? `Reservada · ${nombre}` : "Reservada";
  }
  return "Disponible";
}
