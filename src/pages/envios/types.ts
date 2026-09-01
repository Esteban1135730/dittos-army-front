export type PedidoMapa =
  | { kind: "tienda"; store_id: string; lat: number; lng: number }
  | { kind: "domicilio_bogota" }
  | { kind: "omitido"; reason: "fuera_bogota" | "sin_direccion" };

export type PedidoCalendarioItem = {
  id: string;
  client_id: string;
  client_name: string;
  status: "reservado" | "pagado";
  entrega_en_tienda: boolean;
  store_id?: string;
  store_name?: string;
  store_address?: string;
  ciudad?: string;
  direccion_o_punto?: string;
  notas_entrega?: string;
  fecha_tentativa_entrega: string;
  overdue: boolean;
  mapa: PedidoMapa;
};

export type PedidoCalendarioResponse = {
  from: string;
  to: string;
  today: string;
  items: PedidoCalendarioItem[];
};

export type DayCount = {
  count: number;
  overdue_count: number;
  items: PedidoCalendarioItem[];
};

export type CalendarCell = {
  ymd: string;
  day: number;
  inMonth: boolean;
};
