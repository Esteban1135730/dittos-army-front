import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiBase, apiUrl } from '../../config/api';
import {
  buildCreateTandaCardsPayload,
  rankPanelCandidates,
  type PanelHomologItem,
  type PanelMatchCandidate,
  type SentHomologUnit,
} from '../../utils/sent-unit-homolog';
import { fetchExpansionHomologIndex } from '../../utils/transit-card-match';
import { fxUnitPriceFromSentUnit } from '../../utils/purchase-currency';
import {
  useHomologActive,
  useHomologMutations,
} from '../incoming-v2/use-incoming-homolog';
import { HomologCardImage } from '../incoming-v2/homolog-card-image';
import {
  resolveBlueprintImageSrc,
  resolvePanelImageSrc,
  useHomologBlueprintImages,
} from '../incoming-v2/use-homolog-blueprint-images';
import { HomologMetaSection } from '../incoming-v2/homolog-meta-panel';
import { HomologPriceBlock } from '../incoming-v2/homolog-price-block';
import { PanelItemPrices } from '../incoming-v2/panel-item-prices';
import { buildSentUnitMetaLines } from '../incoming-v2/homolog-meta-builders';
import { formatFx, formatHomologDate } from '../incoming-v2/homolog-format';
import {
  buildPanelItemSearchHaystack,
  buildSentUnitSearchHaystack,
  filterByHomologSearch,
} from '../incoming-v2/homolog-search';
import { HomologSearchField } from '../incoming-v2/homolog-search-field';
import { NovedadDialog } from '../incoming-v2/novedad-dialog';
import { HomologCreateTandaPanel } from '../incoming-v2/homolog-create-tanda-panel';
import { useAutoVerifyByBlueprint } from './use-cardtrader-receipt-session';
import { exportSentUnitsByBlueprintToPdf } from './export-sent-units-pdf';

const API_CARDTRADER = apiUrl('/cardtrader');

function axiosMsg(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const msg = e.response?.data?.message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg) && typeof msg[0] === 'string') return msg[0];
  }
  return 'Error en la operación.';
}

function unitStatusColor(status: SentHomologUnit['status']) {
  if (status === 'verified') return 'success';
  if (status === 'novedad') return 'warning';
  return 'default';
}

function tierLabel(tier: PanelMatchCandidate['matchTier']): string {
  if (tier === 'product') return 'Product ID';
  if (tier === 'exact') return 'Blueprint';
  if (tier === 'best') return 'Nombre / precio';
  return 'Posible';
}

/** Match perfecto: product_id idéntico, o blueprint + precio exacto. */
function isPerfectMatch(c: PanelMatchCandidate): boolean {
  if (c.matchTier === 'product') return true;
  return (
    c.matchTier === 'exact' &&
    c.priceDelta != null &&
    c.priceDelta < 0.0001
  );
}

function CandidateRow(props: {
  candidate: PanelMatchCandidate;
  onSelect: () => void;
  disabled?: boolean;
  imageSrc?: string;
}) {
  const { candidate, onSelect, disabled, imageSrc } = props;
  const perfect = isPerfectMatch(candidate);
  const isProduct = candidate.matchTier === 'product';
  const isExact = candidate.matchTier === 'exact';
  const isBest = candidate.matchTier === 'best';
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        borderWidth: perfect ? 2 : 1,
        borderColor: perfect
          ? '#1b5e20'
          : isExact
            ? '#2e7d32'
            : isBest
              ? '#1565c0'
              : '#e0e0e0',
        bgcolor: perfect
          ? '#c8e6c9'
          : isExact
            ? '#e8f5e9'
            : isBest
              ? '#e3f2fd'
              : '#fff',
        boxShadow: perfect ? '0 0 0 1px #1b5e20' : undefined,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'stretch' }}>
        <HomologCardImage src={imageSrc} alt={candidate.cardName} variant="candidate" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" mb={0.5}>
            <Typography variant="subtitle2" fontWeight={600}>
              {candidate.cardName}
            </Typography>
            {perfect ? (
              <Chip
                size="small"
                label="Match perfecto"
                color="success"
                sx={{ fontWeight: 700 }}
              />
            ) : (
              <Chip
                size="small"
                label={tierLabel(candidate.matchTier)}
                color={isExact ? 'success' : isBest ? 'primary' : 'default'}
              />
            )}
            {perfect && isProduct ? (
              <Chip size="small" variant="outlined" color="success" label="Product ID" />
            ) : null}
            {perfect && isExact ? (
              <Chip size="small" variant="outlined" color="success" label="BP + precio" />
            ) : null}
            <Chip
              size="small"
              variant="outlined"
              label={`Disp. ${candidate.availableInSession}`}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block">
            Lote {formatHomologDate(candidate.lotPurchaseDate)} · {candidate.language}
            {candidate.rareza ? ` · ${candidate.rareza}` : ''}
            {candidate.productId ? ` · P#${candidate.productId}` : ''}
            {candidate.blueprintId ? ` · BP#${candidate.blueprintId}` : ''}
            {perfect
              ? ' · precio exacto'
              : candidate.priceDelta != null
                ? ` · Δ ${candidate.priceDelta.toFixed(2)}`
                : ''}
          </Typography>
        </Box>
        <PanelItemPrices
          unitCostCop={candidate.unitCostCop}
          eurUnitPrice={candidate.fxUnitPrice}
          eurTotalLot={candidate.fxTotalLot}
          currency={candidate.cardsCostCurrency}
        />
        <Button
          size="small"
          variant="contained"
          color={perfect ? 'success' : 'primary'}
          onClick={onSelect}
          disabled={disabled}
          sx={{ alignSelf: 'center', minWidth: 88, fontWeight: perfect ? 700 : 500 }}
        >
          {perfect ? 'Asignar' : 'Elegir'}
        </Button>
      </Box>
    </Paper>
  );
}

export default function CardtraderReceiptPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: activeData, isLoading } = useHomologActive();

  const {
    createSession,
    syncSent,
    verifyUnit,
    markNovedad,
    undoUnit,
    createTanda,
    cancelSession,
    revertConversion,
  } = useHomologMutations();

  const session = activeData?.session ?? null;
  const panelItems = activeData?.panel_items ?? [];
  const sessionId = session?.session_id;

  const autoVerify = useAutoVerifyByBlueprint(sessionId);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [novedadOpen, setNovedadOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [appliedSentSearch, setAppliedSentSearch] = useState('');
  const [appliedTransitSearch, setAppliedTransitSearch] = useState('');
  const [sentStatusFilter, setSentStatusFilter] = useState<'all' | 'pending' | 'novedad'>(
    'pending',
  );

  const units = session?.units ?? [];
  const summary = session?.summary ?? { total: 0, pending: 0, verified: 0, novedad: 0 };
  const { blueprintImages, imagesLoading } = useHomologBlueprintImages(units);

  const expansions = useMemo(
    () => [...new Set(units.map((u) => u.expansion).filter(Boolean))],
    [units],
  );

  const { data: expansionHomolog = {} } = useQuery({
    queryKey: ['receipt-expansion-homolog', expansions.join('|')],
    enabled: expansions.length > 0,
    queryFn: () =>
      fetchExpansionHomologIndex(async (expansion) => {
        const res = await axios.get(`${API_CARDTRADER}/tcgdex/resolve`, {
          params: { expansion },
        });
        return res.data as { tcgdex_set_id?: string | null };
      }, expansions),
    staleTime: 60_000 * 30,
  });

  const selectedUnit = useMemo(
    () => units.find((u) => u.sent_unit_key === selectedKey) ?? null,
    [units, selectedKey],
  );

  const candidates = useMemo(() => {
    if (!selectedUnit || selectedUnit.status !== 'pending') return [];
    return rankPanelCandidates({
      sentUnit: selectedUnit,
      panelItems,
      expansionHomolog,
    });
  }, [selectedUnit, panelItems, expansionHomolog]);

  const productCandidates = candidates.filter((c) => c.matchTier === 'product');
  const exactCandidates = candidates.filter((c) => c.matchTier === 'exact');
  const bestCandidates = candidates.filter((c) => c.matchTier === 'best');
  const possibleCandidates = candidates.filter((c) => c.matchTier === 'possible');
  const perfectCandidates = candidates.filter(isPerfectMatch);
  const hasPerfectMatch = perfectCandidates.length > 0;

  /** Para cada sent pendiente: si tiene al menos un match perfecto en tránsito. */
  const perfectMatchBySentKey = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const u of units) {
      if (u.status !== 'pending') continue;
      const ranked = rankPanelCandidates({
        sentUnit: u,
        panelItems,
        expansionHomolog,
      });
      map.set(u.sent_unit_key, ranked.some(isPerfectMatch));
    }
    return map;
  }, [units, panelItems, expansionHomolog]);

  const sentSearchHaystackByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of units) {
      map.set(u.sent_unit_key, buildSentUnitSearchHaystack(u));
    }
    return map;
  }, [units]);

  const transitSearchHaystackById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of panelItems) {
      map.set(p.transit_line_id, buildPanelItemSearchHaystack(p));
    }
    return map;
  }, [panelItems]);

  const filteredSentUnits = useMemo(() => {
    const base =
      sentStatusFilter === 'all'
        ? units
        : units.filter((u) => u.status === sentStatusFilter);
    return filterByHomologSearch(
      base,
      (u) => sentSearchHaystackByKey.get(u.sent_unit_key) ?? '',
      appliedSentSearch,
    );
  }, [units, appliedSentSearch, sentSearchHaystackByKey, sentStatusFilter]);

  /** Búsqueda manual en tránsito: con sent pendiente, blueprint primero y precio exacto arriba. */
  const rankedTransitBrowse = useMemo(() => {
    if (!selectedUnit || selectedUnit.status !== 'pending') {
      return filterByHomologSearch(
        panelItems,
        (p) => transitSearchHaystackById.get(p.transit_line_id) ?? '',
        appliedTransitSearch,
      );
    }

    const ranked = rankPanelCandidates({
      sentUnit: selectedUnit,
      panelItems,
      expansionHomolog,
    });

    const sentBp =
      typeof selectedUnit.blueprint_id === 'number' && selectedUnit.blueprint_id > 0
        ? selectedUnit.blueprint_id
        : null;

    const blueprintRanked =
      sentBp != null
        ? ranked.filter((r) => r.blueprintId === sentBp)
        : ranked;

    const rankedIds = new Set(blueprintRanked.map((r) => r.transitLineId));
    const filtered = filterByHomologSearch(
      panelItems,
      (p) => transitSearchHaystackById.get(p.transit_line_id) ?? '',
      appliedTransitSearch,
    );

    const browsePool =
      sentBp != null
        ? filtered.filter(
            (p) =>
              typeof p.blueprint_id === 'number' &&
              p.blueprint_id > 0 &&
              p.blueprint_id === sentBp,
          )
        : filtered;

    const byId = new Map(blueprintRanked.map((r) => [r.transitLineId, r]));
    return [...browsePool].sort((a, b) => {
      const ra = byId.get(a.transit_line_id);
      const rb = byId.get(b.transit_line_id);
      if (ra && rb) {
        return blueprintRanked.indexOf(ra) - blueprintRanked.indexOf(rb);
      }
      if (ra && !rb) return -1;
      if (!ra && rb) return 1;
      if (rankedIds.has(a.transit_line_id) !== rankedIds.has(b.transit_line_id)) {
        return rankedIds.has(a.transit_line_id) ? -1 : 1;
      }
      return a.card_name.localeCompare(b.card_name, 'es');
    });
  }, [
    selectedUnit,
    panelItems,
    expansionHomolog,
    appliedTransitSearch,
    transitSearchHaystackById,
  ]);

  const handleStart = async () => {
    setError(null);
    try {
      await createSession.mutateAsync();
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        await queryClient.invalidateQueries({ queryKey: ['incoming-homolog-active'] });
        return;
      }
      setError(axiosMsg(e));
    }
  };

  const handleCancelAndRestart = async () => {
    if (!sessionId) return;
    const ok = window.confirm(
      '¿Cancelar la sesión actual y comenzar una nueva?\n\nSe perderá el progreso de homologación no guardado.',
    );
    if (!ok) return;
    setError(null);
    try {
      await cancelSession.mutateAsync(sessionId);
      await createSession.mutateAsync();
    } catch (e) {
      setError(axiosMsg(e));
    }
  };

  const handleSyncAndAutoMatch = async () => {
    if (!sessionId) return;
    setError(null);
    setInfo(null);
    try {
      await syncSent.mutateAsync(sessionId);
      const result = await autoVerify.mutateAsync();
      if (result.auto_verified > 0) {
        const parts = [
          `${result.auto_verified} verificada(s)`,
          result.by_product_id
            ? `${result.by_product_id} por product_id`
            : null,
          result.by_blueprint_id
            ? `${result.by_blueprint_id} por blueprint`
            : null,
        ].filter(Boolean);
        setInfo(`Auto-match: ${parts.join(' · ')}.`);
      } else {
        setInfo('Sync completado. Revisa candidatas para match manual.');
      }
    } catch (e) {
      setError(axiosMsg(e));
    }
  };

  const handleExportPdf = async () => {
    setError(null);
    setInfo(null);
    if (units.length === 0) {
      setError('No hay cartas en envío para exportar. Haz Sync CT primero.');
      return;
    }
    setExportingPdf(true);
    try {
      const result = await exportSentUnitsByBlueprintToPdf(
        units.map((u) => ({
          name: u.name,
          language: u.language,
          rareza: u.rareza,
          blueprint_id: u.blueprint_id,
          qty: 1,
          imageUrl: resolveBlueprintImageSrc(u.blueprint_id, blueprintImages),
        })),
        {
          title: 'Cartas en envío (CardTrader)',
          apiBase: apiBase(),
          imageUrlByBlueprint: blueprintImages,
        },
      );
      const imgNote =
        result.imageFailures > 0
          ? ` (${result.imageFailures} sin imagen)`
          : '';
      setInfo(
        `PDF exportado: ${result.rows} carta(s) · ${result.units} unidad(es)${imgNote}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar el PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleVerifyCandidate = async (candidate: PanelMatchCandidate) => {
    if (!sessionId || !selectedUnit) return;
    setError(null);
    try {
      await verifyUnit.mutateAsync({
        sessionId,
        sentUnitKey: selectedUnit.sent_unit_key,
        transitLineId: candidate.transitLineId,
        matchScore: candidate.structuralScore,
      });
    } catch (e) {
      setError(axiosMsg(e));
    }
  };

  const handleVerifyPanelItem = async (item: PanelHomologItem) => {
    if (!sessionId || !selectedUnit || selectedUnit.status !== 'pending') return;
    if (item.available_in_session <= 0) {
      setError('Este ítem no tiene unidades disponibles.');
      return;
    }
    setError(null);
    try {
      await verifyUnit.mutateAsync({
        sessionId,
        sentUnitKey: selectedUnit.sent_unit_key,
        transitLineId: item.transit_line_id,
      });
    } catch (e) {
      setError(axiosMsg(e));
    }
  };

  const handleNovedadSubmit = async (payload: {
    notes: string;
    transitLineId?: string;
  }) => {
    if (!sessionId || !selectedUnit) return;
    setError(null);
    try {
      await markNovedad.mutateAsync({
        sessionId,
        sentUnitKey: selectedUnit.sent_unit_key,
        notes: payload.notes,
        transitLineId: payload.transitLineId,
      });
      setNovedadOpen(false);
    } catch (e) {
      setError(axiosMsg(e));
    }
  };

  const handleCreateTanda = async (shippingTotalCop: number) => {
    if (!sessionId || !session) return;
    setError(null);
    try {
      const cards = buildCreateTandaCardsPayload(units, panelItems);
      const res = await createTanda.mutateAsync({
        sessionId,
        shipping_total_cop: shippingTotalCop,
        cards,
      });
      if (res.round_id) {
        navigate(`/incoming/ship-round/${res.round_id}`);
      } else {
        await queryClient.invalidateQueries({ queryKey: ['incoming-homolog-active'] });
      }
    } catch (e) {
      setError(axiosMsg(e));
    }
  };

  const isBusy =
    syncSent.isPending ||
    autoVerify.isPending ||
    verifyUnit.isPending ||
    undoUnit.isPending ||
    markNovedad.isPending ||
    createTanda.isPending;

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return (
      <Box maxWidth={600} mx="auto" py={6}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Recepción CT
        </Typography>
        <Typography color="text.secondary" paragraph>
          Homologa las <strong>cartas enviadas (sent)</strong> de CardTrader contra tu
          inventario en tránsito. Match automático por <strong>product_id</strong>{' '}
          (mismo Product CT en compra y envío); si no hay, por blueprint o selección
          manual.
        </Typography>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Button
          variant="contained"
          size="large"
          onClick={() => void handleStart()}
          disabled={createSession.isPending}
        >
          {createSession.isPending ? 'Iniciando…' : 'Iniciar sesión de recepción'}
        </Button>
      </Box>
    );
  }

  if (session.status === 'converted') {
    const handleRevert = async () => {
      if (!sessionId) return;
      setError(null);
      try {
        await revertConversion.mutateAsync(sessionId);
      } catch (e) {
        setError(axiosMsg(e));
      }
    };

    const handleNewFromConverted = async () => {
      setError(null);
      try {
        await createSession.mutateAsync();
      } catch (e) {
        setError(axiosMsg(e));
      }
    };

    return (
      <Box maxWidth={720} mx="auto" py={4}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Recepción CT
        </Typography>
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        <Alert severity="success" sx={{ mb: 2 }}>
          Sesión convertida
          {session.ship_round_id ? (
            <>
              {' '}
              — tanda <strong>{session.ship_round_id}</strong>
            </>
          ) : null}
          .
        </Alert>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {session.ship_round_id ? (
            <Button
              component={Link}
              to={`/incoming/ship-round/${session.ship_round_id}`}
              variant="contained"
            >
              Ir a tanda
            </Button>
          ) : null}
          <Button
            variant="outlined"
            color="warning"
            onClick={() => void handleRevert()}
            disabled={revertConversion.isPending || createSession.isPending}
          >
            {revertConversion.isPending ? 'Restaurando…' : 'Restaurar sesión'}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleNewFromConverted()}
            disabled={revertConversion.isPending || createSession.isPending}
          >
            {createSession.isPending ? 'Iniciando…' : 'Nueva sesión de recepción'}
          </Button>
        </Stack>
      </Box>
    );
  }

  const selectedSentImage = selectedUnit
    ? resolveBlueprintImageSrc(selectedUnit.blueprint_id, blueprintImages)
    : undefined;

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={2}
        mb={2}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Recepción CT
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sent → tránsito. Auto: product_id → blueprint. Manual: mejores candidatas
            arriba.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Chip label={`${summary.verified} verificadas`} color="success" size="small" />
          <Chip label={`${summary.pending} pendientes`} size="small" />
          {summary.novedad > 0 && (
            <Chip label={`${summary.novedad} novedad`} color="warning" size="small" />
          )}
          <Button
            size="small"
            variant="outlined"
            onClick={() => void handleSyncAndAutoMatch()}
            disabled={isBusy}
          >
            {syncSent.isPending || autoVerify.isPending
              ? 'Procesando…'
              : 'Sync CT + Auto-match'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void handleExportPdf()}
            disabled={isBusy || exportingPdf || units.length === 0 || imagesLoading}
          >
            {exportingPdf
              ? 'Generando PDF…'
              : imagesLoading
                ? 'Cargando imágenes…'
                : 'Exportar PDF'}
          </Button>
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={() => void handleCancelAndRestart()}
            disabled={isBusy || cancelSession.isPending || createSession.isPending}
          >
            Nueva sesión
          </Button>
        </Stack>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      {info ? (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setInfo(null)}>
          {info}
        </Alert>
      ) : null}

      {units.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Sesión sin sent units. Usa <strong>Sync CT + Auto-match</strong> para importar lo
          enviado desde CardTrader.
        </Alert>
      ) : null}

      {summary.pending === 0 || summary.verified > 0 ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#fafafa' }}>
          <HomologCreateTandaPanel
            pendingCount={summary.pending}
            totalUnits={summary.total}
            verifiedCount={summary.verified}
            isSubmitting={createTanda.isPending}
            onCreate={handleCreateTanda}
          />
        </Paper>
      ) : null}

      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', lg: '340px 1fr 300px' }}
        gap={2}
      >
        {/* Columna 1: sent units */}
        <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 680, overflow: 'auto' }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Enviadas (sent) ({filteredSentUnits.length})
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mb: 1 }}>
            <Chip
              label="Todas"
              size="small"
              clickable
              color={sentStatusFilter === 'all' ? 'primary' : 'default'}
              variant={sentStatusFilter === 'all' ? 'filled' : 'outlined'}
              onClick={() => setSentStatusFilter('all')}
            />
            <Chip
              label={`Pendientes (${summary.pending})`}
              size="small"
              clickable
              color={sentStatusFilter === 'pending' ? 'primary' : 'default'}
              variant={sentStatusFilter === 'pending' ? 'filled' : 'outlined'}
              onClick={() => setSentStatusFilter('pending')}
            />
            <Chip
              label={`Novedad (${summary.novedad})`}
              size="small"
              clickable
              color={sentStatusFilter === 'novedad' ? 'warning' : 'default'}
              variant={sentStatusFilter === 'novedad' ? 'filled' : 'outlined'}
              onClick={() => setSentStatusFilter('novedad')}
            />
          </Stack>
          <HomologSearchField
            placeholder="Buscar nombre, pedido… (Enter)"
            onApply={setAppliedSentSearch}
            sx={{ mb: 1.5 }}
          />
          <Stack spacing={1}>
            {filteredSentUnits.map((u) => {
              const thumbSrc = resolveBlueprintImageSrc(u.blueprint_id, blueprintImages);
              const hasPerfect = perfectMatchBySentKey.get(u.sent_unit_key) === true;
              const isSelected = selectedKey === u.sent_unit_key;
              return (
                <Paper
                  key={u.sent_unit_key}
                  variant="outlined"
                  onClick={() => setSelectedKey(u.sent_unit_key)}
                  sx={{
                    p: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 1,
                    alignItems: 'center',
                    borderWidth: hasPerfect ? 2 : 1,
                    borderColor: isSelected
                      ? '#1565c0'
                      : hasPerfect
                        ? '#1b5e20'
                        : '#e0e0e0',
                    bgcolor: isSelected
                      ? '#e3f2fd'
                      : hasPerfect
                        ? '#e8f5e9'
                        : 'transparent',
                  }}
                >
                  <HomologCardImage
                    src={thumbSrc}
                    alt={u.name}
                    variant="list"
                    loading={imagesLoading && !!u.blueprint_id && !thumbSrc}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" gap={0.5} alignItems="center">
                      <Typography variant="body2" fontWeight={600} noWrap>
                        {u.name}
                      </Typography>
                      {hasPerfect && u.status === 'pending' ? (
                        <Chip
                          size="small"
                          color="success"
                          label="Match"
                          sx={{ fontWeight: 700, height: 22 }}
                        />
                      ) : (
                        <Chip size="small" color={unitStatusColor(u.status)} label={u.status} />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" noWrap>
                      {u.order_code}
                      {u.blueprint_id ? ` · BP#${u.blueprint_id}` : ''}
                      {u.rareza ? ` · ${u.rareza}` : ''}
                    </Typography>
                    {u.transit_line_card_name ? (
                      <Typography variant="caption" color="success.main" display="block" noWrap>
                        → {u.transit_line_card_name}
                      </Typography>
                    ) : hasPerfect && u.status === 'pending' ? (
                      <Typography variant="caption" color="success.dark" display="block" noWrap fontWeight={600}>
                        Match perfecto disponible
                      </Typography>
                    ) : null}
                  </Box>
                  <Typography
                    variant="caption"
                    fontWeight={600}
                    color={hasPerfect ? 'success.dark' : 'text.secondary'}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {formatFx(
                      fxUnitPriceFromSentUnit(u).amount,
                      fxUnitPriceFromSentUnit(u).currency,
                    )}
                  </Typography>
                </Paper>
              );
            })}
          </Stack>
        </Paper>

        {/* Columna 2: detalle + candidatas rankeadas */}
        <Paper variant="outlined" sx={{ p: 2, minHeight: 400 }}>
          {!selectedUnit ? (
            <Typography color="text.secondary">
              Selecciona una carta sent para ver candidatas de tránsito.
            </Typography>
          ) : (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={2}>
                <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                    CardTrader (sent)
                  </Typography>
                  <HomologCardImage
                    src={selectedSentImage}
                    alt={selectedUnit.name}
                    variant="detail"
                    loading={
                      imagesLoading && !!selectedUnit.blueprint_id && !selectedSentImage
                    }
                  />
                </Box>
              </Stack>

              <Typography variant="h6" fontWeight={600} gutterBottom>
                {selectedUnit.name}
              </Typography>
              <Box mb={2}>
                <HomologPriceBlock
                  fx={fxUnitPriceFromSentUnit(selectedUnit).amount}
                  currency={fxUnitPriceFromSentUnit(selectedUnit).currency}
                  fxLabel="Precio CardTrader"
                  size="md"
                />
              </Box>
              <HomologMetaSection
                title="Pedido CardTrader"
                lines={buildSentUnitMetaLines(selectedUnit)}
                columns={2}
              />

              {selectedUnit.status === 'verified' ? (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Homologada con <strong>{selectedUnit.transit_line_card_name}</strong>
                  <Box mt={1}>
                    <Button
                      size="small"
                      onClick={() =>
                        sessionId &&
                        undoUnit.mutate({
                          sessionId,
                          sentUnitKey: selectedUnit.sent_unit_key,
                        })
                      }
                      disabled={undoUnit.isPending}
                    >
                      Deshacer
                    </Button>
                  </Box>
                </Alert>
              ) : null}

              {selectedUnit.status === 'novedad' ? (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Novedad: {selectedUnit.novedad_notes || '(sin nota)'}
                  <Box mt={1}>
                    <Button
                      size="small"
                      onClick={() =>
                        sessionId &&
                        undoUnit.mutate({
                          sessionId,
                          sentUnitKey: selectedUnit.sent_unit_key,
                        })
                      }
                      disabled={undoUnit.isPending}
                    >
                      Deshacer
                    </Button>
                  </Box>
                </Alert>
              ) : null}

              {selectedUnit.status === 'pending' ? (
                <Box mt={2}>
                  {hasPerfectMatch ? (
                    <Alert severity="success" sx={{ mb: 2 }} icon={false}>
                      <Typography variant="body2" fontWeight={700}>
                        Match perfecto encontrado
                      </Typography>
                      <Typography variant="body2">
                        {perfectCandidates.length === 1
                          ? `Hay 1 candidata exacta (${perfectCandidates[0].matchTier === 'product' ? 'mismo product_id' : 'blueprint + precio'}).`
                          : `Hay ${perfectCandidates.length} candidatas exactas. Asigna la de precio coincidente.`}
                      </Typography>
                    </Alert>
                  ) : null}

                  <Stack direction="row" spacing={1} mb={2}>
                    <Button
                      size="small"
                      color="warning"
                      variant="outlined"
                      onClick={() => setNovedadOpen(true)}
                    >
                      Marcar novedad
                    </Button>
                    {perfectCandidates[0] ? (
                      <Button
                        size="small"
                        color="success"
                        variant="contained"
                        disabled={verifyUnit.isPending}
                        onClick={() => void handleVerifyCandidate(perfectCandidates[0])}
                      >
                        Asignar match perfecto
                      </Button>
                    ) : null}
                  </Stack>

                  {candidates.length === 0 ? (
                    <Alert severity="warning">
                      Sin candidatas automáticas. Usa el panel derecho para buscar en
                      tránsito y elegir manualmente.
                    </Alert>
                  ) : (
                    <Stack spacing={1.5}>
                      {productCandidates.length > 0 ? (
                        <>
                          <Typography variant="subtitle2" fontWeight={600}>
                            Product ID exacto
                          </Typography>
                          {productCandidates.map((c) => (
                            <CandidateRow
                              key={c.transitLineId}
                              candidate={c}
                              imageSrc={resolvePanelImageSrc(c.imageUrl)}
                              onSelect={() => void handleVerifyCandidate(c)}
                              disabled={verifyUnit.isPending}
                            />
                          ))}
                        </>
                      ) : null}

                      {exactCandidates.length > 0 ? (
                        <>
                          {productCandidates.length > 0 ? <Divider sx={{ my: 1 }} /> : null}
                          <Typography variant="subtitle2" fontWeight={600}>
                            Blueprint exacto
                          </Typography>
                          {exactCandidates.map((c) => (
                            <CandidateRow
                              key={c.transitLineId}
                              candidate={c}
                              imageSrc={resolvePanelImageSrc(c.imageUrl)}
                              onSelect={() => void handleVerifyCandidate(c)}
                              disabled={verifyUnit.isPending}
                            />
                          ))}
                        </>
                      ) : null}

                      {bestCandidates.length > 0 ? (
                        <>
                          {productCandidates.length > 0 || exactCandidates.length > 0 ? (
                            <Divider sx={{ my: 1 }} />
                          ) : null}
                          <Typography variant="subtitle2" fontWeight={600}>
                            Mejores match (nombre / precio / expansión)
                          </Typography>
                          {bestCandidates.map((c) => (
                            <CandidateRow
                              key={c.transitLineId}
                              candidate={c}
                              imageSrc={resolvePanelImageSrc(c.imageUrl)}
                              onSelect={() => void handleVerifyCandidate(c)}
                              disabled={verifyUnit.isPending}
                            />
                          ))}
                        </>
                      ) : null}

                      {possibleCandidates.length > 0 ? (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="subtitle2" fontWeight={600}>
                            Posibles (por nombre)
                          </Typography>
                          {possibleCandidates.map((c) => (
                            <CandidateRow
                              key={c.transitLineId}
                              candidate={c}
                              imageSrc={resolvePanelImageSrc(c.imageUrl)}
                              onSelect={() => void handleVerifyCandidate(c)}
                              disabled={verifyUnit.isPending}
                            />
                          ))}
                        </>
                      ) : null}
                    </Stack>
                  )}
                </Box>
              ) : null}
            </>
          )}
        </Paper>

        {/* Columna 3: catálogo tránsito con búsqueda ordenada */}
        <Paper variant="outlined" sx={{ p: 2, maxHeight: 680, overflow: 'auto' }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Tránsito (compras) ({rankedTransitBrowse.length}/{panelItems.length})
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            Catálogo de tránsito. Con sent pendiente: filtra por blueprint si aplica;
            precio exacto arriba. Clic para asignar.
          </Typography>
          <HomologSearchField
            placeholder="Buscar nombre, BP#, precio… (Enter)"
            onApply={setAppliedTransitSearch}
            sx={{ mb: 1.5 }}
          />
          {rankedTransitBrowse.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {appliedTransitSearch.trim()
                ? 'Sin resultados.'
                : 'Sin líneas de tránsito disponibles.'}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {rankedTransitBrowse.map((item) => {
                const rank = candidates.find((c) => c.transitLineId === item.transit_line_id);
                const perfect = rank ? isPerfectMatch(rank) : false;
                const canPick =
                  selectedUnit?.status === 'pending' && item.available_in_session > 0;
                return (
                  <Paper
                    key={item.transit_line_id}
                    variant="outlined"
                    onClick={() => {
                      if (canPick) void handleVerifyPanelItem(item);
                    }}
                    sx={{
                      p: 1,
                      cursor: canPick ? 'pointer' : 'default',
                      opacity: item.available_in_session > 0 ? 1 : 0.5,
                      borderWidth: perfect ? 2 : 1,
                      borderColor: perfect
                        ? '#1b5e20'
                        : rank?.matchTier === 'exact'
                          ? '#2e7d32'
                          : rank?.matchTier === 'best'
                            ? '#1565c0'
                            : '#e0e0e0',
                      bgcolor: perfect ? '#e8f5e9' : 'transparent',
                      '&:hover': canPick ? { bgcolor: perfect ? '#c8e6c9' : 'action.hover' } : {},
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center">
                      <HomologCardImage
                        src={resolvePanelImageSrc(item.image_url)}
                        alt={item.card_name}
                        variant="list"
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
                            {item.card_name}
                          </Typography>
                          {perfect ? (
                            <Chip
                              size="small"
                              color="success"
                              label="Perfecto"
                              sx={{ fontWeight: 700, height: 20, fontSize: 10 }}
                            />
                          ) : null}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Disp. {item.available_in_session}/{item.remaining_quantity}
                          {item.blueprint_id ? ` · BP#${item.blueprint_id}` : ''}
                          {rank && !perfect ? ` · ${tierLabel(rank.matchTier)}` : ''}
                          {perfect ? ' · precio exacto' : ''}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Box>

      <NovedadDialog
        open={novedadOpen}
        onClose={() => setNovedadOpen(false)}
        panelItems={panelItems}
        onSubmit={handleNovedadSubmit}
        isSubmitting={markNovedad.isPending}
      />
    </Box>
  );
}
