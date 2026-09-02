import AbonosCapitalBlock from "./abonos-capital-block";
import {
  useAddReservaIncomingAbono,
  useDeleteReservaIncomingAbono,
  useReservaIncomingAbonos,
} from "./use-reserva-incoming-abonos";

type NotifyFn = (message: string, severity: "success" | "error") => void;

type Props = {
  clientId: string;
  enabled?: boolean;
  onNotify: NotifyFn;
};

export default function ReservaIncomingAbonosBlock({
  clientId,
  enabled = true,
  onNotify,
}: Props) {
  const { data, isLoading, isError, error } = useReservaIncomingAbonos(
    clientId,
    enabled,
  );
  const addMutation = useAddReservaIncomingAbono(clientId);
  const deleteMutation = useDeleteReservaIncomingAbono(clientId);

  if (!enabled) return null;

  return (
    <AbonosCapitalBlock
      data={data}
      isLoading={isLoading}
      isError={isError}
      error={error}
      allowMutate
      addPending={addMutation.isPending}
      deletePending={deleteMutation.isPending}
      onAdd={(amount) => addMutation.mutateAsync(amount).then(() => undefined)}
      onDelete={(id) => deleteMutation.mutateAsync(id).then(() => undefined)}
      onNotify={onNotify}
    />
  );
}
