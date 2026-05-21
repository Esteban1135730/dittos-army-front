import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { apiClient } from "../../api/client";
import { formatCop } from "./facturacion-electronica.utils";
import type { BillableItem, InvoiceLineForm } from "./facturacion-electronica.utils";

type Props = {
  clientId: string | null;
  clientName?: string;
  existingLines: InvoiceLineForm[];
  onApplyLines: (lines: InvoiceLineForm[]) => void;
};

export default function FacturacionProductosPicker({
  clientId,
  clientName,
  existingLines,
  onApplyLines,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, isError } = useQuery({
    queryKey: ["billable-items", clientId],
    queryFn: async () => {
      const res = await apiClient.get<{
        success: boolean;
        items: BillableItem[];
        message?: string;
      }>(`/billing/factus/client/${clientId}/billable-items`);
      if (!res.data?.success) {
        throw new Error(res.data?.message ?? "No se pudieron cargar los productos");
      }
      return res.data.items ?? [];
    },
    enabled: !!clientId,
  });

  const items = data ?? [];

  const selectedTotal = useMemo(() => {
    return items
      .filter((i) => selected.has(i.key))
      .reduce((s, i) => s + i.amountCop, 0);
  }, [items, selected]);

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.key)));
    }
  };

  const applySelected = (mode: "replace" | "append") => {
    const newLines: InvoiceLineForm[] = items
      .filter((i) => selected.has(i.key))
      .map((i) => billableToLine(i));

    if (mode === "replace") {
      onApplyLines(newLines);
      return;
    }

    const existingKeys = new Set(
      existingLines.map((l) => l.sourceKey).filter(Boolean) as string[]
    );
    const merged = [
      ...existingLines,
      ...newLines.filter((l) => l.sourceKey && !existingKeys.has(l.sourceKey)),
    ];
    onApplyLines(merged.length > 0 ? merged : newLines);
  };

  if (!clientId) {
    return (
      <Alert severity="warning" variant="outlined">
        En el paso 1 elige un <strong>cliente de la tienda</strong> para cargar sus
        reservas y ventas con precio automático.
      </Alert>
    );
  }

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle1" fontWeight={600}>
          Productos del cliente
          {clientName ? `: ${clientName}` : ""}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Marca las cartas vendidas o en reserva; los precios en COP se suman solos en
          la factura (una línea por carta).
        </Typography>

        {isLoading && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={22} />
            <Typography variant="body2">Cargando reservas y ventas…</Typography>
          </Box>
        )}

        {isError && (
          <Alert severity="error">
            No se pudieron cargar los productos. ¿Está el backend en marcha?
          </Alert>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <Alert severity="info">
            Este cliente no tiene reservas activas ni ventas registradas con su ID.
            Puedes añadir líneas manualmente abajo.
          </Alert>
        )}

        {items.length > 0 && (
          <>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={
                          items.length > 0 && selected.size === items.length
                        }
                        indeterminate={
                          selected.size > 0 && selected.size < items.length
                        }
                        onChange={toggleAll}
                      />
                    </TableCell>
                    <TableCell>Carta</TableCell>
                    <TableCell>Origen</TableCell>
                    <TableCell align="right">Precio COP</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.key}
                      hover
                      selected={selected.has(item.key)}
                      onClick={() => toggle(item.key)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={selected.has(item.key)}
                          onChange={() => toggle(item.key)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {item.cardName}
                        </Typography>
                        {item.variant && (
                          <Typography variant="caption" color="text.secondary">
                            {item.variant}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={
                            item.source === "reserva"
                              ? "Reserva"
                              : "Venta"
                          }
                          color={
                            item.source === "reserva" ? "warning" : "success"
                          }
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        {formatCop(item.amountCop)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ sm: "center" }}
              justifyContent="space-between"
            >
              <Typography variant="body2">
                Seleccionados: <strong>{selected.size}</strong> — Subtotal:{" "}
                <strong>{formatCop(selectedTotal)}</strong>
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  size="small"
                  variant="contained"
                  disabled={selected.size === 0}
                  onClick={() => applySelected("replace")}
                >
                  Usar en factura
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={selected.size === 0}
                  onClick={() => applySelected("append")}
                >
                  Añadir a líneas
                </Button>
              </Stack>
            </Stack>
          </>
        )}
      </Stack>
    </Paper>
  );
}

function billableToLine(item: BillableItem): InvoiceLineForm {
  const desc = item.variant
    ? `${item.cardName} (${item.variant})`
    : item.cardName;
  return {
    description: `Carta TCG — ${desc}`,
    quantity: 1,
    unitPriceCop: item.amountCop,
    codeReference: item.cardId.slice(0, 20),
    sourceKey: item.key,
  };
}
