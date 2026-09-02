import AbonosCapitalBlock from "./abonos-capital-block";
import {
  useAddPedidoAbono,
  useDeletePedidoAbono,
  usePedidoAbonos,
} from "./use-pedido-abonos";

type NotifyFn = (message: string, severity: "success" | "error") => void;

type Props = {
  pedidoId: string;
  allowMutate: boolean;
  enabled?: boolean;
  onNotify: NotifyFn;
};

export default function PedidoAbonosBlock({
  pedidoId,
  allowMutate,
  enabled = true,
  onNotify,
}: Props) {
  const { data, isLoading, isError, error } = usePedidoAbonos(pedidoId, enabled);
  const addMutation = useAddPedidoAbono(pedidoId);
  const deleteMutation = useDeletePedidoAbono(pedidoId);

  if (!enabled) return null;

  return (
    <AbonosCapitalBlock
      data={data}
      isLoading={isLoading}
      isError={isError}
      error={error}
      allowMutate={allowMutate}
      addPending={addMutation.isPending}
      deletePending={deleteMutation.isPending}
      onAdd={(amount) => addMutation.mutateAsync(amount).then(() => undefined)}
      onDelete={(id) => deleteMutation.mutateAsync(id).then(() => undefined)}
      onNotify={onNotify}
      hideOnConflict={false}
    />
  );
}
