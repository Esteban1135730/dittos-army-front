import { Box, Typography } from "@mui/material";
import type { TiendaEntregaCatalogItem } from "./pedido-types";

type TiendaCardProps = {
  tienda: TiendaEntregaCatalogItem;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
};

export function TiendaEntregaCard({
  tienda,
  selected,
  onSelect,
  disabled = false,
}: TiendaCardProps) {
  return (
    <Box
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: 2,
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "action.selected" : "background.paper",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        transition: "border-color 0.15s",
        "&:hover": disabled
          ? undefined
          : { borderColor: selected ? "primary.main" : "primary.light" },
      }}
    >
      <Typography variant="subtitle2" fontWeight={700}>
        {tienda.name}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
        {tienda.address}
      </Typography>
    </Box>
  );
}

type PickerProps = {
  tiendas: TiendaEntregaCatalogItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
};

export function TiendaEntregaPicker({
  tiendas,
  selectedId,
  onSelect,
  disabled = false,
}: PickerProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
        gap: 1,
      }}
    >
      {tiendas.map((t) => (
        <TiendaEntregaCard
          key={t.id}
          tienda={t}
          selected={selectedId === t.id}
          onSelect={() => onSelect(t.id)}
          disabled={disabled}
        />
      ))}
    </Box>
  );
}
