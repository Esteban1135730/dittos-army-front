import { apiUrl } from "../../config/api";

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

export const API_CLIENT = apiUrl("/client");
export const API_RESERVA = apiUrl("/reserva");
export const API_STOCK = apiUrl("/stock");
export const API_SALES = apiUrl("/sales");
export const API_INCOMING = apiUrl("/incoming");

export type ImportWhatsAppLineResult = {
  index: number;
  raw: string;
  parsed?: {
    card_id: string;
    language: string;
    rareza: string | null;
    quantity: number;
  };
  requested: number;
  matched: number;
  stock_ids: string[];
  precio_cop_por_unidad: number[];
  issues: string[];
};

export type ImportWhatsAppPreviewResponse = {
  client_id: string;
  client_name_from_message: string | null;
  lines: ImportWhatsAppLineResult[];
  summary: {
    lines_ok: number;
    lines_partial: number;
    lines_failed: number;
    units_reserved: number;
  };
};

export type ImportWhatsAppImportResponse = ImportWhatsAppPreviewResponse & {
  created: { stock_id: string; reserva_id: string; precio: number; currency: string }[];
  skipped: { line_index: number; reason: string; requested: number; matched: number }[];
};

/** Línea de reserva pendiente (en camino), respuesta de GET /reserva/incoming */
export type ReservaIncomingItem = {
  _id: string;
  client_id: string;
  batch_item_id: string;
  quantity: number;
  created_at?: string;
  updated_at?: string;
  card_name?: string;
  card_id?: string;
  image_url?: string;
  rareza?: string;
  remaining_quantity?: number;
  language?: string;
};

export const ALERTA_HORAS_AMARILLO = 48;
export const ALERTA_HORAS_ROJO = 168;
