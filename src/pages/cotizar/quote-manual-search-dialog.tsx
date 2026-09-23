import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { API_BASE, getApiTcgHeader } from "../../config/api";
import { cardTraderGameIdForTcg } from "../../config/cardtrader-games";
import type { PedidoQuoteCandidate } from "../../utils/parse-cardtrader-pedido";

type CtExpansion = { id: number; name?: string; name_en?: string; code?: string };

type SearchItem = {
  blueprint_id: number;
  expansion_id: number;
  expansion_name?: string;
  name?: string;
  collector_number?: string;
  image_url?: string | null;
};

function normalizeExpansions(data: unknown): CtExpansion[] {
  if (Array.isArray(data)) {
    return data.filter(
      (x): x is CtExpansion => !!x && typeof x === "object" && typeof (x as CtExpansion).id === "number",
    );
  }
  if (data && typeof data === "object" && "expansions" in data) {
    return normalizeExpansions((data as { expansions: unknown }).expansions);
  }
  return [];
}

function normalizeBlueprints(data: unknown): Array<{
  id: number;
  name?: string;
  name_en?: string;
  image_url?: string | null;
  fixed_properties?: { collector_number?: string };
}> {
  if (!Array.isArray(data)) return [];
  return data.filter((x) => x && typeof x === "object" && typeof (x as { id: number }).id === "number");
}

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (candidate: PedidoQuoteCandidate) => void;
};

export function QuoteManualSearchDialog({ open, onClose, onPick }: Props) {
  const [expansion, setExpansion] = useState<CtExpansion | null>(null);
  const [nameQ, setNameQ] = useState("");
  const [submittedQ, setSubmittedQ] = useState("");
  const cardTraderGameId = cardTraderGameIdForTcg(getApiTcgHeader());

  const expansionsQuery = useQuery({
    queryKey: ["cardtrader", "expansions", cardTraderGameId],
    enabled: open,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/cardtrader/expansions`, {
        params: { game_id: cardTraderGameId },
      });
      return normalizeExpansions(res.data);
    },
  });

  const searchQuery = useQuery({
    queryKey: ["cardtrader", "blueprints", "search", cardTraderGameId, submittedQ],
    enabled: open && !expansion && submittedQ.length >= 2,
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/cardtrader/blueprints/search`, {
        params: { q: submittedQ, game_id: cardTraderGameId },
      });
      const items = Array.isArray((res.data as { items?: SearchItem[] })?.items)
        ? (res.data as { items: SearchItem[] }).items
        : [];
      return items.filter((x) => typeof x.blueprint_id === "number" && typeof x.expansion_id === "number");
    },
  });

  const setBlueprintsQuery = useQuery({
    queryKey: ["cardtrader", "blueprints", expansion?.id],
    enabled: open && !!expansion?.id,
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/cardtrader/blueprints`, {
        params: { expansion_id: expansion!.id },
      });
      return normalizeBlueprints(res.data);
    },
  });

  const setFiltered = useMemo(() => {
    const q = nameQ.trim().toLowerCase();
    const list = setBlueprintsQuery.data ?? [];
    if (!q) return list.slice(0, 40);
    return list
      .filter((b) => {
        const name = String(b.name_en ?? b.name ?? "").toLowerCase();
        const num = String(b.fixed_properties?.collector_number ?? "");
        return name.includes(q) || num.toLowerCase().includes(q);
      })
      .slice(0, 40);
  }, [setBlueprintsQuery.data, nameQ]);

  const nameItems = searchQuery.data ?? [];

  const pickSearch = (item: SearchItem) => {
    onPick({
      blueprintId: item.blueprint_id,
      expansionId: item.expansion_id,
      expansionName: item.expansion_name ?? "",
      name: item.name ?? "",
      collectorNumber: item.collector_number ?? "",
      imageUrl: item.image_url ?? null,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Búsqueda manual</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete
            options={expansionsQuery.data ?? []}
            value={expansion}
            onChange={(_, v) => {
              setExpansion(v);
              setSubmittedQ("");
            }}
            getOptionLabel={(o) => o.name_en ?? o.name ?? o.code ?? String(o.id)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => (
              <TextField {...params} label="Expansión (opcional)" placeholder="Otro set…" />
            )}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              fullWidth
              label="Nombre o número"
              value={nameQ}
              onChange={(e) => setNameQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !expansion) {
                  e.preventDefault();
                  setSubmittedQ(nameQ.trim());
                }
              }}
            />
            {!expansion && (
              <Button
                variant="contained"
                onClick={() => setSubmittedQ(nameQ.trim())}
                disabled={nameQ.trim().length < 2 || searchQuery.isFetching}
                sx={{ height: 56, flexShrink: 0 }}
              >
                {searchQuery.isFetching ? "Buscando…" : "Buscar"}
              </Button>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Sin expansión: pulsa Buscar o Enter. Con expansión: el nombre filtra el set (sin llamar al search).
          </Typography>
          {expansion && setBlueprintsQuery.isFetching && <CircularProgress size={24} />}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 1,
              maxHeight: 420,
              overflowY: "auto",
            }}
          >
            {expansion
              ? setFiltered.map((b) => (
                  <Card
                    key={b.id}
                    variant="outlined"
                    sx={{ cursor: "pointer" }}
                    onClick={() => {
                      onPick({
                        blueprintId: b.id,
                        expansionId: expansion.id,
                        expansionName: expansion.name_en ?? expansion.name ?? "",
                        name: b.name_en ?? b.name ?? "",
                        collectorNumber: b.fixed_properties?.collector_number ?? "",
                        imageUrl: b.image_url ?? null,
                      });
                      onClose();
                    }}
                  >
                    {b.image_url ? (
                      <CardMedia component="img" height="120" image={b.image_url} alt="" sx={{ objectFit: "contain" }} />
                    ) : (
                      <Box sx={{ height: 120, bgcolor: "grey.200" }} />
                    )}
                    <CardContent sx={{ py: 1 }}>
                      <Typography variant="body2" noWrap>
                        {b.name_en ?? b.name ?? `#${b.id}`}
                      </Typography>
                    </CardContent>
                  </Card>
                ))
              : nameItems.map((item) => (
                  <Card
                    key={item.blueprint_id}
                    variant="outlined"
                    sx={{ cursor: "pointer" }}
                    onClick={() => pickSearch(item)}
                  >
                    {item.image_url ? (
                      <CardMedia component="img" height="120" image={item.image_url} alt="" sx={{ objectFit: "contain" }} />
                    ) : (
                      <Box sx={{ height: 120, bgcolor: "grey.200" }} />
                    )}
                    <CardContent sx={{ py: 1 }}>
                      <Typography variant="body2" noWrap>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {item.expansion_name}
                        {item.collector_number ? ` · #${item.collector_number}` : ""}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}
