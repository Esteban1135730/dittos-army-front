import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiUrl } from '../../config/api';
import type { HomologSessionResponse } from '../incoming-v2/use-incoming-homolog';

const API_HOMOLOG = apiUrl('/incoming/homolog');

export type AutoVerifyResult = HomologSessionResponse & {
  auto_verified: number;
  by_product_id?: number;
  by_blueprint_id?: number;
  product_ids_backfilled?: number;
};

export function useAutoVerifyByBlueprint(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<AutoVerifyResult> => {
      if (!sessionId) throw new Error('No hay sesión activa');
      const res = await axios.post<AutoVerifyResult>(
        `${API_HOMOLOG}/sessions/${sessionId}/auto-verify-by-product`,
      );
      return res.data;
    },
    onSuccess: async (data, _vars) => {
      queryClient.setQueryData(['incoming-homolog-active'], data);
      if (sessionId) {
        queryClient.setQueryData(['incoming-homolog-session', sessionId], data);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['incoming-homolog-active'] }),
        sessionId
          ? queryClient.invalidateQueries({
              queryKey: ['incoming-homolog-session', sessionId],
            })
          : Promise.resolve(),
      ]);
    },
  });
}
