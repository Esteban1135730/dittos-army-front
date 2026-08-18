import axios from "axios";
import { API_PEDIDO, type PedidoItem } from "./pedido-types";

/** No tumba la pantalla si el módulo Pedido aún no está desplegado. */
export async function fetchPedidosByClient(clientId: string): Promise<PedidoItem[]> {
  if (!clientId) return [];
  try {
    const res = await axios.get(`${API_PEDIDO}/client/${clientId}`);
    return Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 404 || status === 403 || status === 501) return [];
    }
    throw err;
  }
}

export function isPedidoApiLikelyMissing(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    (error.response?.status === 404 || error.response?.status === 403)
  );
}
