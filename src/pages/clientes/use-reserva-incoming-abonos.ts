import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  API_RESERVA,
  type ReservaIncomingAbonosResponse,
} from "./cliente-types";

export const reservaIncomingAbonosQueryKey = (clientId: string) =>
  ["reserva-incoming-abonos", clientId] as const;

export async function invalidateReservaIncomingAbonos(
  queryClient: QueryClient,
  clientId: string | undefined,
): Promise<void> {
  if (!clientId) return;
  await queryClient.invalidateQueries({
    queryKey: reservaIncomingAbonosQueryKey(clientId),
  });
}

export function useReservaIncomingAbonos(
  clientId: string | undefined,
  enabled = true,
) {
  return useQuery<ReservaIncomingAbonosResponse>({
    queryKey: reservaIncomingAbonosQueryKey(clientId ?? ""),
    queryFn: async () => {
      const res = await axios.get<ReservaIncomingAbonosResponse>(
        `${API_RESERVA}/incoming/client/${clientId}/abonos`,
      );
      return res.data;
    },
    enabled: Boolean(clientId) && enabled,
    retry: (count, err) => {
      if (axios.isAxiosError(err) && err.response?.status === 409) return false;
      return count < 2;
    },
  });
}

export function useAddReservaIncomingAbono(clientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amount_cop: number) => {
      if (!clientId) throw new Error("clientId requerido");
      const res = await axios.post<ReservaIncomingAbonosResponse>(
        `${API_RESERVA}/incoming/client/${clientId}/abonos`,
        { amount_cop },
      );
      return res.data;
    },
    onSuccess: async () => {
      await invalidateReservaIncomingAbonos(queryClient, clientId);
    },
  });
}

export function useDeleteReservaIncomingAbono(clientId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (abonoId: string) => {
      if (!clientId) throw new Error("clientId requerido");
      await axios.delete(
        `${API_RESERVA}/incoming/client/${clientId}/abonos/${abonoId}`,
      );
    },
    onSuccess: async () => {
      await invalidateReservaIncomingAbonos(queryClient, clientId);
    },
  });
}
