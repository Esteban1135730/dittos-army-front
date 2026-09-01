import axios from "axios";
import { apiUrl } from "../../config/api";
import type { PedidoCalendarioResponse } from "./types";

export async function fetchPedidoCalendario(
  from: string,
  to: string,
): Promise<PedidoCalendarioResponse> {
  const res = await axios.get(apiUrl("/pedido/calendario"), {
    params: { from, to },
  });
  const data = res.data as PedidoCalendarioResponse;
  return {
    from: data?.from ?? from,
    to: data?.to ?? to,
    today: data?.today ?? "",
    items: Array.isArray(data?.items) ? data.items : [],
  };
}
