import { IconButton, Stack, Tooltip } from "@mui/material";
import { Link } from "react-router-dom";
import {
  IconBookmark,
  IconCart,
  IconTag,
} from "../../../components/layout/panel-nav-icons";
import { isQuantityProduct } from "../../../constants/bulk-product";
import type { StockListItem } from "../../../types/stock";
import { IconPencil, IconTrash } from "./stock-action-icons";

type StockRowActionsProps = {
  row: StockListItem;
  marcandoPropiedad: string | null;
  onModificar: (id: string) => void;
  onMarcarPropiedad: (id: string, cardId: string) => void;
  onVender: (row: StockListItem) => void;
  onEliminar: (row: StockListItem) => void;
};

export function StockRowActions({
  row,
  marcandoPropiedad,
  onModificar,
  onMarcarPropiedad,
  onVender,
  onEliminar,
}: StockRowActionsProps) {
  const soldOrOwned = row.card_state === "vendida" || row.card_state === "propiedad";
  const owned = row.card_state === "propiedad";
  const qtyBlocked =
    isQuantityProduct({
      product_kind: row.product_kind,
      card_id: row.card_id,
    }) && !(typeof row.quantity === "number" && row.quantity > 0);
  const sellDisabled = soldOrOwned || qtyBlocked;
  const keepDisabled = owned || marcandoPropiedad === row._id;
  const tienePvp = Boolean(row.pvp && row.pvp > 0);

  return (
    <Stack
      direction="row"
      spacing={0.25}
      alignItems="center"
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip title="Modificar">
        <IconButton
          size="small"
          aria-label="Modificar"
          onClick={() => onModificar(row._id)}
        >
          <IconPencil />
        </IconButton>
      </Tooltip>
      <Tooltip title={tienePvp ? "Modificar PVP" : "Asignar PVP"}>
        <IconButton
          size="small"
          aria-label={tienePvp ? "Modificar PVP" : "Asignar PVP"}
          component={Link}
          to={`/add-pvp/${row.card_id}`}
          color="primary"
        >
          <IconTag />
        </IconButton>
      </Tooltip>
      <Tooltip title={owned ? "Ya en propiedad" : "Quedarme (propiedad)"}>
        <span>
          <IconButton
            size="small"
            aria-label="Quedarme"
            disabled={keepDisabled}
            color="secondary"
            onClick={() => onMarcarPropiedad(row._id, row.card_id)}
          >
            <IconBookmark />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={sellDisabled ? "No se puede vender" : "Registrar venta"}>
        <span>
          <IconButton
            size="small"
            aria-label="Registrar venta"
            disabled={sellDisabled}
            color="success"
            onClick={() => onVender(row)}
          >
            <IconCart />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Eliminar">
        <IconButton
          size="small"
          aria-label="Eliminar línea"
          color="error"
          onClick={() => onEliminar(row)}
        >
          <IconTrash />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}
