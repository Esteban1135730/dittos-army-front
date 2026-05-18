/** Tipos compartidos del módulo Clientes (panel). */

export type ClientItem = {
  _id: string;
  nombre: string;
  tienda_entrega: string;
  celular?: string;
  facebook_usuario?: string;
  metodo_contacto: "whatsapp" | "facebook";
  notas?: string;
};

export type ReservaItem = {
  _id: string;
  client_id: string;
  stock_id: string;
  precio: number;
  currency: string;
  /** Fecha de creación de la reserva (puede faltar en documentos antiguos). */
  created_at?: string;
};

export type VentaClienteRow = {
  _id: string;
  stock_id: string;
  card_id: string;
  amount_cop: number;
  notes?: string;
  created_at: string;
};

export type ClienteFormState = {
  nombre: string;
  tiendaEntrega: string;
  celular: string;
  facebookUsuario: string;
  metodoContacto: "whatsapp" | "facebook";
  notas: string;
};

export const emptyClienteForm = (): ClienteFormState => ({
  nombre: "",
  tiendaEntrega: "",
  celular: "",
  facebookUsuario: "",
  metodoContacto: "whatsapp",
  notas: "",
});

export const formFromClient = (c: ClientItem): ClienteFormState => ({
  nombre: c.nombre,
  tiendaEntrega: c.tienda_entrega,
  celular: c.celular ?? "",
  facebookUsuario: c.facebook_usuario ?? "",
  metodoContacto: c.metodo_contacto,
  notas: c.notas ?? "",
});

/** Rutas relativas al `baseURL` del `apiClient` (`src/api/client.ts`). */
export const API_CLIENT = "/client";
export const API_RESERVA = "/reserva";
export const API_STOCK = "/stock";
export const API_SALES = "/sales";

export const ALERTA_HORAS_AMARILLO = 48;
export const ALERTA_HORAS_ROJO = 168;
