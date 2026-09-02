import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import axios from "axios";
import { API_PEDIDO } from "./pedido-types";

export type PedidoAbonoItem = {
  id: string;
  amount_cop: number;
  created_at: string;
};

export type PedidoAbonosResponse = {
  pedido_id: string;
  total_pvp_cop: number;
  abonado_cop: number;
  saldo_cop: number;
  abonos: PedidoAbonoItem[];
};

export const pedidoAbonosQueryKey = (pedidoId: string) =>
  ["pedido-abonos", pedidoId] as const;

export async function invalidatePedidoAbonos(
  queryClient: QueryClient,
  pedidoId: string | undefined,
): Promise<void> {
  if (!pedidoId) return;
  await queryClient.invalidateQueries({
    queryKey: pedidoAbonosQueryKey(pedidoId),
  });
}

export function usePedidoAbonos(pedidoId: string | undefined, enabled = true) {
  return useQuery<PedidoAbonosResponse>({
    queryKey: pedidoAbonosQueryKey(pedidoId ?? ""),
    queryFn: async () => {
      const res = await axios.get<PedidoAbonosResponse>(
        `${API_PEDIDO}/${pedidoId}/abonos`,
      );
      return res.data;
    },
    enabled: Boolean(pedidoId) && enabled,
    retry: (count, err) => {
      if (axios.isAxiosError(err) && (err.response?.status === 404 || err.response?.status === 409)) {
        return false;
      }
      return count < 2;
    },
  });
}

export function useAddPedidoAbono(pedidoId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amount_cop: number) => {
      if (!pedidoId) throw new Error("pedidoId requerido");
      const res = await axios.post<PedidoAbonosResponse>(
        `${API_PEDIDO}/${pedidoId}/abonos`,
        { amount_cop },
      );
      return res.data;
    },
    onSuccess: async () => {
      await invalidatePedidoAbonos(queryClient, pedidoId);
    },
  });
}

export function useDeletePedidoAbono(pedidoId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (abonoId: string) => {
      if (!pedidoId) throw new Error("pedidoId requerido");
      await axios.delete(`${API_PEDIDO}/${pedidoId}/abonos/${abonoId}`);
    },
    onSuccess: async () => {
      await invalidatePedidoAbonos(queryClient, pedidoId);
    },
  });
}
