import { useEffect, useMemo, useState } from 'react';
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
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiUrl } from '../../config/api';
import {
  buildCreateTandaCardsPayload,
  rankPanelCandidates,
  resolveNovedadUnitCostCop,
  type PanelHomologItem,
  type PanelMatchCandidate,
  type SentHomologUnit,
  type SystemTrmRates,
} from '../../utils/sent-unit-homolog';
import { fetchExpansionHomologIndex } from '../../utils/transit-card-match';
import {
  useHomologActive,
  useHomologMutations,
  useHomologNovedades,
} from './use-incoming-homolog';
import { HomologCardImage } from './homolog-card-image';
import {
  resolveBlueprintImageSrc,
  resolvePanelImageSrc,
  useHomologBlueprintImages,
} from './use-homolog-blueprint-images';
import { collectTcgdexIdsFromLines, useTcgdexCardDetails } from '../../pokemon';
import { resolveTransitCatalogImageSrc } from '../cardtrader-transit/cardtrader-transit-catalog-image';
import { HomologMetaSection } from './homolog-meta-panel';
import { HomologPriceBlock, HomologPriceChip } from './homolog-price-block';
import { PanelItemPriceChip, PanelItemPrices } from './panel-item-prices';
import {
  buildSentUnitMetaLines,
  buildVerifiedMatchMetaLines,
} from './homolog-meta-builders';
import { fxUnitPriceFromSentUnit } from '../../utils/purchase-currency';
import { normalizeCardsCostCurrency } from '../../utils/purchase-currency';
import { formatFx, formatHomologDate } from './homolog-format';
import {
  buildPanelItemSearchHaystack,
  buildSentUnitSearchHaystack,
  filterByHomologSearch,
} from './homolog-search';
import { HomologSearchField } from './homolog-search-field';
import { NovedadDialog } from './novedad-dialog';
import { HomologCreateTandaPanel } from './homolog-create-tanda-panel';
import {
  countOrphanNovedadUnits,
  HomologNovedadStockSection,
} from './homolog-novedad-stock-section';
import { useNovedadStockList } from './novedad-stock/use-novedad-stock';
import { useExchangeRates } from '../../utils/tasa';

const API_CARDTRADER = apiUrl('/cardtrader');

type SentStatusFilter = 'all' | 'pending' | 'novedad';

function unitStatusColor(status: SentHomologUnit['status']) {
  if (status === 'verified') return 'success';
  if (status === 'novedad') return 'warning';
  return 'default';
}

function homologUnitDisplayCop(
  unit: SentHomologUnit,
  systemTrm: SystemTrmRates,
): number | null {
  if (unit.unit_cost_cop != null && unit.unit_cost_cop > 0) {
    return unit.unit_cost_cop;
  }
  if (unit.status === 'novedad') {
    return resolveNovedadUnitCostCop(unit, systemTrm);
  }
  return null;
}

function candidateTierLabel(tier: PanelMatchCandidate['matchTier']): string {
  if (tier === 'product') return 'Product ID';
  if (tier === 'exact') return 'Blueprint exacto';
  if (tier === 'best') return 'Match completo';
  return 'Posible';
}

function CandidateRow(props: {
  candidate: PanelMatchCandidate;
  onSelect: () => void;
  disabled?: boolean;
  imageSrc?: string;
}) {
  const { candidate, onSelect, disabled, imageSrc } = props;
  const isProduct = candidate.matchTier === 'product';
  const isExact = candidate.matchTier === 'exact';
  const isBest = candidate.matchTier === 'best';
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        borderColor: isProduct
          ? '#1b5e20'
          : isExact
            ? '#2e7d32'
            : isBest
              ? '#1565c0'
              : '#e0e0e0',
        bgcolor: isProduct
          ? '#c8e6c9'
          : isExact
            ? '#e8f5e9'
            : isBest
              ? '#e3f2fd'
              : '#fff',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'stretch' }}>
        <HomologCardImage
          src={imageSrc}
          alt={candidate.cardName}
          variant="candidate"
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" mb={0.5}>
            <Typography variant="subtitle2" fontWeight={600}>
              {candidate.cardName}
            </Typography>
            <Chip
              size="small"
              label={candidateTierLabel(candidate.matchTier)}
              color={
                isProduct || isExact
                  ? 'success'
                  : isBest
                    ? 'primary'
                    : 'default'
              }
            />
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
            {candidate.priceDelta != null
              ? ` · Δ precio ${candidate.priceDelta.toFixed(2)}`
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
          onClick={onSelect}
          disabled={disabled}
          sx={{ alignSelf: 'center', minWidth: 88 }}
        >
          Elegir
        </Button>
      </Box>
    </Paper>
  );
}

export default function IncomingV2Page() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { rates, isPrompting } = useExchangeRates();
  const systemTrm = useMemo<SystemTrmRates>(
    () => ({ euroToCop: rates.euroToCop, usdToCop: rates.usdToCop }),
    [rates.euroToCop, rates.usdToCop],
  );
  const { data: activeData, isLoading: activeLoading } = useHomologActive();
  const { data: novedades = [] } = useHomologNovedades();
  const { data: novedadStockRows = [] } = useNovedadStockList();
  const {
    createSession,
    syncSent,
    verifyUnit,
    markNovedad,
    undoUnit,
    createTanda,
    cancelSession,
    resolveNovedad,
    revertConversion,
    axiosMessage,
  } = useHomologMutations();

  const session = activeData?.session;
  const panelItems = activeData?.panel_items ?? [];
  const batchesSummary = activeData?.batches_summary ?? [];
  const sessionId = session?.session_id;

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [novedadOpen, setNovedadOpen] = useState(false);
  const [appliedSentSearch, setAppliedSentSearch] = useState('');
  const [appliedInventorySearch, setAppliedInventorySearch] = useState('');
  const [sentStatusFilter, setSentStatusFilter] = useState<SentStatusFilter>('all');

  const expansions = useMemo(() => {
    const set = new Set<string>();
    for (const u of session?.units ?? []) {
      if (u.expansion?.trim()) set.add(u.expansion.trim());
    }
    return [...set];
  }, [session?.units]);

  const { data: expansionHomolog = {} } = useQuery({
    queryKey: ['incoming-v2-expansion-homolog', expansions.join('|')],
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

  const units = session?.units ?? [];
  const { blueprintImages, imagesLoading } = useHomologBlueprintImages(units);

  const panelCardIds = useMemo(
    () => collectTcgdexIdsFromLines(panelItems),
    [panelItems],
  );
  const { detailsByCardId: panelTcgDetails, isLoading: panelTcgImagesLoading } =
    useTcgdexCardDetails(panelCardIds);

  const panelImageByTransitLineId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of panelItems) {
      const src = resolveTransitCatalogImageSrc(
        p.card_id,
        p.image_url,
        panelTcgDetails,
        p.language,
      );
      if (src) map.set(p.transit_line_id, src);
    }
    return map;
  }, [panelItems, panelTcgDetails]);

  const panelItemByTransitLineId = useMemo(() => {
    return new Map(panelItems.map((p) => [p.transit_line_id, p]));
  }, [panelItems]);

  const summary = session?.summary ?? {
    total: 0,
    pending: 0,
    verified: 0,
    novedad: 0,
  };

  const orphanNovedadCount = useMemo(
    () => countOrphanNovedadUnits(units),
    [units],
  );
  const novedadStockPending = useMemo(
    () =>
      sessionId
        ? novedadStockRows.filter(
            (r) => r.session_id === sessionId && r.status === 'pending',
          ).length
        : 0,
    [novedadStockRows, sessionId],
  );
  const showNovedadWorkflow =
    orphanNovedadCount > 0 || novedadStockPending > 0 || summary.novedad > 0;

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

  const selectedSentImage = selectedUnit
    ? resolveBlueprintImageSrc(selectedUnit.blueprint_id, blueprintImages)
    : undefined;

  const selectedPanelImage = selectedUnit?.transit_line_id
    ? panelImageByTransitLineId.get(selectedUnit.transit_line_id)
    : undefined;

  const selectedPanelItem = selectedUnit?.transit_line_id
    ? panelItemByTransitLineId.get(selectedUnit.transit_line_id)
    : undefined;

  const selectedUnitDisplayCop = selectedUnit
    ? homologUnitDisplayCop(selectedUnit, systemTrm)
    : null;

  const sentSearchHaystackByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of units) {
      map.set(u.sent_unit_key, buildSentUnitSearchHaystack(u));
    }
    return map;
  }, [units]);

  const panelSearchHaystackById = useMemo(() => {
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

  const sentListDenominator =
    sentStatusFilter === 'pending'
      ? summary.pending
      : sentStatusFilter === 'novedad'
        ? summary.novedad
        : units.length;
  const sentListFiltered =
    sentStatusFilter !== 'all' || appliedSentSearch.trim().length > 0;

  const filteredPanelItems = useMemo(
    () =>
      filterByHomologSearch(
        panelItems,
        (p) => panelSearchHaystackById.get(p.transit_line_id) ?? '',
        appliedInventorySearch,
      ),
    [panelItems, appliedInventorySearch, panelSearchHaystackById],
  );

  useEffect(() => {
    if (!selectedKey && units.length > 0) {
      const firstPending = units.find((u) => u.status === 'pending');
      if (firstPending) setSelectedKey(firstPending.sent_unit_key);
    }
  }, [units, selectedKey]);

  const handleStart = async () => {
    setError(null);
    try {
      await createSession.mutateAsync();
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        await queryClient.invalidateQueries({ queryKey: ['incoming-homolog-active'] });
        return;
      }
      setError(axiosMessage(e));
    }
  };

  const handleSync = async () => {
    if (!sessionId) return;
    setError(null);
    try {
      await syncSent.mutateAsync(sessionId);
    } catch (e) {
      setError(axiosMessage(e));
    }
  };

  const handleVerify = async (candidate: PanelMatchCandidate) => {
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
      setError(axiosMessage(e));
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
      setError(axiosMessage(e));
    }
  };

  const handleVerifyPanelItem = async (item: PanelHomologItem) => {
    if (!sessionId || !selectedUnit || selectedUnit.status !== 'pending') return;
    if (item.available_in_session <= 0) {
      setError('Este ítem no tiene unidades disponibles en la sesión.');
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
      setError(axiosMessage(e));
    }
  };

  const handleCreateTanda = async (shippingTotalCop: number) => {
    if (!sessionId || !session) return;
    if (summary.pending > 0) {
      setError('Quedan cartas sent sin verificar ni marcar como novedad.');
      return;
    }
    if (novedadStockPending > 0) {
      setError(
        `Hay ${novedadStockPending} novedad(es) sin pasar a stock. Usa el Paso 1 arriba antes de crear la tanda.`,
      );
      return;
    }
    setError(null);
    try {
      const cards = buildCreateTandaCardsPayload(units, panelItems, systemTrm);
      const res = await createTanda.mutateAsync({
        sessionId,
        shipping_total_cop: shippingTotalCop,
        cards,
      });
      if (res.round_id) {
        navigate(`/incoming-v2/ship-round/${res.round_id}`);
      } else {
        await queryClient.invalidateQueries({ queryKey: ['incoming-homolog-active'] });
      }
    } catch (e) {
      setError(axiosMessage(e));
    }
  };

  if (activeLoading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return (
      <Box maxWidth={720} mx="auto">
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Homologación CT
        </Typography>
        <Typography color="text.secondary" paragraph>
          Homologa cada carta <strong>sent</strong> de CardTrader contra tu inventario en
          camino antes de crear la tanda.
        </Typography>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Button
          variant="contained"
          onClick={handleStart}
          disabled={createSession.isPending}
        >
          {createSession.isPending ? 'Iniciando…' : 'Iniciar homologación'}
        </Button>
      </Box>
    );
  }

  if (session.status === 'converted') {
    const handleRevertConversion = async () => {
      if (!sessionId) return;
      setError(null);
      try {
        await revertConversion.mutateAsync(sessionId);
        await queryClient.invalidateQueries({ queryKey: ['incoming-homolog-active'] });
      } catch (e) {
        setError(axiosMessage(e));
      }
    };

    return (
      <Box maxWidth={720} mx="auto">
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Alert severity="success" sx={{ mb: 2 }}>
          Esta sesión ya generó una tanda
          {session.ship_round_id ? (
            <>
              {' '}
              (<strong>{session.ship_round_id}</strong>)
            </>
          ) : null}
          .
        </Alert>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          {session.ship_round_id ? (
            <Button
              component={Link}
              to={`/incoming-v2/ship-round/${session.ship_round_id}`}
              variant="contained"
            >
              Ir a revisar tanda
            </Button>
          ) : null}
          <Button
            variant="outlined"
            color="warning"
            onClick={() => void handleRevertConversion()}
            disabled={revertConversion.isPending}
          >
            {revertConversion.isPending ? 'Restaurando…' : 'Restaurar homologación'}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
          Restaurar elimina la tanda en revisión y recupera el progreso de homologación (solo si la
          tanda no fue finalizada a stock).
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={2}
        mb={3}
      >
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Homologación CT
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Homologación 1:1 · solo pedidos <strong>sent</strong>
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Chip label={`${summary.verified} verificadas`} color="success" size="small" />
          <Chip label={`${summary.novedad} novedad`} color="warning" size="small" />
          <Chip label={`${summary.pending} pendientes`} size="small" />
          <Button size="small" onClick={handleSync} disabled={syncSent.isPending}>
            {syncSent.isPending ? 'Sincronizando…' : 'Sync CardTrader'}
          </Button>
          <Button
            size="small"
            color="error"
            onClick={() => sessionId && cancelSession.mutate(sessionId)}
            disabled={cancelSession.isPending}
          >
            Cancelar sesión
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

      {showNovedadWorkflow || summary.pending === 0 ? (
        <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: '#fafafa' }}>
          {summary.novedad > 0 && isPrompting ? (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Hay {summary.novedad} carta(s) marcadas como novedad. Configura las tasas EUR/USD → COP
              en el panel lateral para el paso 1 (stock).
            </Alert>
          ) : null}

          <HomologNovedadStockSection
            orphanNovedadCount={orphanNovedadCount}
            sessionId={sessionId}
            onError={setError}
            onInfo={(msg) => {
              setError(null);
              setInfo(msg);
            }}
          />

          <HomologCreateTandaPanel
            pendingCount={summary.pending}
            totalUnits={summary.total}
            verifiedCount={summary.verified}
            novedadStockPending={novedadStockPending}
            isSubmitting={createTanda.isPending}
            onCreate={handleCreateTanda}
          />
        </Paper>
      ) : null}

      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', lg: '360px 1fr 300px' }}
        gap={2}
      >
        {/* Lista sent */}
        <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 640, overflow: 'auto' }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Cartas sent ({filteredSentUnits.length}
            {sentListFiltered ? ` / ${sentListDenominator}` : ''})
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
              disabled={summary.pending === 0}
            />
            <Chip
              label={`Novedad (${summary.novedad})`}
              size="small"
              clickable
              color={sentStatusFilter === 'novedad' ? 'warning' : 'default'}
              variant={sentStatusFilter === 'novedad' ? 'filled' : 'outlined'}
              onClick={() => setSentStatusFilter('novedad')}
              disabled={summary.novedad === 0}
            />
          </Stack>
          <HomologSearchField
            placeholder="Buscar nombre, pedido, expansión… (Enter)"
            onApply={setAppliedSentSearch}
            sx={{ mb: 1.5 }}
          />
          <Stack spacing={1}>
            {filteredSentUnits.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {appliedSentSearch.trim()
                  ? 'Sin resultados.'
                  : sentStatusFilter === 'pending'
                    ? 'No hay cartas pendientes.'
                    : sentStatusFilter === 'novedad'
                      ? 'No hay cartas con novedad.'
                      : 'No hay cartas sent.'}
              </Typography>
            ) : null}
            {filteredSentUnits.map((u) => {
              const thumbSrc = resolveBlueprintImageSrc(u.blueprint_id, blueprintImages);
              const thumbLoading =
                imagesLoading && !!u.blueprint_id && !thumbSrc;
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
                  borderColor:
                    selectedKey === u.sent_unit_key ? '#1565c0' : '#e0e0e0',
                  bgcolor:
                    selectedKey === u.sent_unit_key ? '#e3f2fd' : 'transparent',
                }}
              >
                <HomologCardImage
                  src={thumbSrc}
                  alt={u.name}
                  variant="list"
                  loading={thumbLoading}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" gap={0.5}>
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {u.name}
                    </Typography>
                    <Chip size="small" color={unitStatusColor(u.status)} label={u.status} />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" display="block" noWrap>
                    {formatHomologDate(u.paid_at)} · {u.order_code}
                    {u.rareza ? ` · ${u.rareza}` : ''}
                  </Typography>
                  {(u.transit_line_card_name ?? u.batch_item_card_name) ? (
                    <Typography variant="caption" color="success.main" display="block" noWrap>
                      → {u.transit_line_card_name ?? u.batch_item_card_name}
                    </Typography>
                  ) : null}
                </Box>
                {u.status === 'verified' || u.status === 'novedad' ? (
                  <HomologPriceChip
                    cop={homologUnitDisplayCop(u, systemTrm)}
                    fx={fxUnitPriceFromSentUnit(u).amount}
                    currency={fxUnitPriceFromSentUnit(u).currency}
                  />
                ) : (
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    {formatFx(
                      fxUnitPriceFromSentUnit(u).amount,
                      fxUnitPriceFromSentUnit(u).currency,
                    )}
                  </Typography>
                )}
              </Paper>
            );
            })}
          </Stack>
        </Paper>

        {/* Detalle + candidatos */}
        <Paper variant="outlined" sx={{ p: 2, minHeight: 400 }}>
          {!selectedUnit ? (
            <Typography color="text.secondary">Selecciona una carta sent.</Typography>
          ) : (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'center', sm: 'flex-start' }}
                mb={2}
              >
                <Box textAlign="center">
                  <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                    CardTrader (sent)
                  </Typography>
                  <HomologCardImage
                    src={selectedSentImage}
                    alt={selectedUnit.name}
                    variant="detail"
                    loading={
                      imagesLoading &&
                      !!selectedUnit.blueprint_id &&
                      !selectedSentImage
                    }
                  />
                </Box>

                {(selectedUnit.status === 'verified' || selectedUnit.status === 'novedad') &&
                selectedPanelImage ? (
                  <Box textAlign="center">
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                      Tu registro
                    </Typography>
                    <HomologCardImage
                      src={selectedPanelImage}
                      alt={selectedUnit.transit_line_card_name ?? selectedUnit.batch_item_card_name ?? 'Panel'}
                      variant="detail"
                    />
                  </Box>
                ) : null}
              </Stack>

              <Typography variant="h6" fontWeight={600} gutterBottom>
                {selectedUnit.name}
              </Typography>

              {(selectedUnit.status === 'verified' || selectedUnit.status === 'novedad') &&
              selectedUnitDisplayCop != null ? (
                <Box mb={2}>
                  <HomologPriceBlock
                    cop={selectedUnitDisplayCop}
                    fx={fxUnitPriceFromSentUnit(selectedUnit).amount}
                    currency={fxUnitPriceFromSentUnit(selectedUnit).currency}
                    copLabel={
                      selectedUnit.status === 'novedad' ? 'Precio TRM (sistema)' : 'Precio de compra'
                    }
                    fxLabel="Pagado"
                    size="lg"
                  />
                </Box>
              ) : (
                <Box mb={2}>
                  <HomologPriceBlock
                    fx={fxUnitPriceFromSentUnit(selectedUnit).amount}
                    currency={fxUnitPriceFromSentUnit(selectedUnit).currency}
                    fxLabel="Precio CardTrader"
                    size="md"
                  />
                </Box>
              )}

              <HomologMetaSection
                title="Pedido CardTrader"
                lines={buildSentUnitMetaLines(selectedUnit)}
                columns={2}
              />

              {selectedUnit.status === 'verified' ? (
                <HomologMetaSection
                  title="Homologación verificada"
                  lines={buildVerifiedMatchMetaLines(selectedUnit, selectedPanelItem)}
                />
              ) : null}

              {selectedUnit.status === 'novedad' && selectedPanelItem ? (
                <HomologMetaSection
                  title="Lote panel relacionado"
                  lines={buildVerifiedMatchMetaLines(selectedUnit, selectedPanelItem)}
                />
              ) : null}

              {selectedUnit.status === 'verified' ? (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Homologada con <strong>{selectedUnit.transit_line_card_name ?? selectedUnit.batch_item_card_name}</strong>
                  <HomologMetaSection
                    title="Detalle del match"
                    lines={buildVerifiedMatchMetaLines(selectedUnit, selectedPanelItem)}
                    columns={2}
                  />
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
                  {selectedUnitDisplayCop == null && isPrompting ? (
                    <Typography variant="body2" display="block" mt={1}>
                      Configura las tasas EUR/USD → COP en el panel lateral para calcular el precio
                      de compra con TRM.
                    </Typography>
                  ) : null}
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
                  <Stack direction="row" spacing={1} mb={2}>
                    <Button
                      size="small"
                      color="warning"
                      variant="outlined"
                      onClick={() => setNovedadOpen(true)}
                    >
                      Marcar novedad
                    </Button>
                  </Stack>

                  {candidates.length === 0 ? (
                    <Alert severity="warning">
                      Sin candidatos en tránsito CardTrader. Marca novedad o revisa el
                      registro del panel.
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
                              onSelect={() => handleVerify(c)}
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
                              onSelect={() => handleVerify(c)}
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
                            Match completo (nombre / precio / expansión)
                          </Typography>
                          {bestCandidates.map((c) => (
                            <CandidateRow
                              key={c.transitLineId}
                              candidate={c}
                              imageSrc={resolvePanelImageSrc(c.imageUrl)}
                              onSelect={() => handleVerify(c)}
                              disabled={verifyUnit.isPending}
                            />
                          ))}
                        </>
                      ) : null}

                      {possibleCandidates.length > 0 ? (
                        <>
                          <Divider sx={{ my: 1 }} />
                          <Typography variant="subtitle2" fontWeight={600}>
                            Posibles (por palabra)
                          </Typography>
                          {possibleCandidates.map((c) => (
                            <CandidateRow
                              key={c.transitLineId}
                              candidate={c}
                              imageSrc={resolvePanelImageSrc(c.imageUrl)}
                              onSelect={() => handleVerify(c)}
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

        {/* Inventario en camino + lotes + crear tanda */}
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2, maxHeight: 360, overflow: 'auto' }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Tránsito CardTrader ({filteredPanelItems.length}
              {appliedInventorySearch.trim() ? ` / ${panelItems.length}` : ''})
            </Typography>
            <HomologSearchField
              placeholder="Buscar nombre, card ID, idioma, lote… (Enter)"
              onApply={setAppliedInventorySearch}
              sx={{ mb: 1.5 }}
            />
            {selectedUnit?.status === 'pending' ? (
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Con una carta sent pendiente seleccionada, puedes elegir un ítem aquí para
                homologar.
              </Typography>
            ) : null}
            {filteredPanelItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {appliedInventorySearch.trim() ? 'Sin resultados.' : 'Sin ítems en camino.'}
              </Typography>
            ) : (
              <Stack spacing={1}>
                {filteredPanelItems.map((item) => {
                  const img = resolveTransitCatalogImageSrc(
                    item.card_id,
                    item.image_url,
                    panelTcgDetails,
                    item.language,
                  );
                  const canPick =
                    selectedUnit?.status === 'pending' && item.available_in_session > 0;
                  return (
                    <Paper
                      key={item.transit_line_id}
                      variant="outlined"
                      onClick={() => canPick && handleVerifyPanelItem(item)}
                      sx={{
                        p: 1,
                        display: 'flex',
                        gap: 1,
                        alignItems: 'center',
                        cursor: canPick ? 'pointer' : 'default',
                        opacity: item.available_in_session <= 0 ? 0.55 : 1,
                        '&:hover': canPick ? { bgcolor: 'action.hover' } : undefined,
                      }}
                    >
                      <HomologCardImage
                        src={img}
                        alt={item.card_name}
                        variant="list"
                        loading={panelTcgImagesLoading && !img}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {item.card_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {formatHomologDate(item.lot_purchase_date)} · {item.language}
                          {item.rareza ? ` · ${item.rareza}` : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Disp. {item.available_in_session} / {item.remaining_quantity}
                        </Typography>
                      </Box>
                      <PanelItemPriceChip
                        unitCostCop={item.unit_cost_cop}
                        eurUnitPrice={item.fx_unit_price}
                        eurTotalLot={item.fx_total_lot}
                        currency={normalizeCardsCostCurrency(item.cards_cost_currency)}
                      />
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, maxHeight: 220, overflow: 'auto' }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Lotes tránsito CT ({batchesSummary.length})
            </Typography>
            {batchesSummary.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin lotes abiertos.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {batchesSummary.map((batch) => (
                  <Paper key={batch.lot_id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {formatHomologDate(batch.purchase_date)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {batch.remaining_total_quantity} uds · {batch.open_items_count} líneas
                        </Typography>
                      </Box>
                      <HomologPriceChip
                        cop={batch.total_cop_cards_cost}
                        eur={batch.total_fx_cards_cost}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, maxHeight: 360, overflow: 'auto' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle2" fontWeight={600}>
                Novedades en registro ({novedades.length})
              </Typography>
              <Button component={Link} to="/incoming-v2/novedad-stock" size="small">
                Cartas con novedad
              </Button>
            </Stack>
            {novedades.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin novedades abiertas.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {novedades.map((n) => {
                  const panelImg = panelImageByTransitLineId.get(n.batch_item_id);
                  return (
                  <Paper key={n.novedad_id} variant="outlined" sx={{ p: 1, display: 'flex', gap: 1 }}>
                    {panelImg ? (
                      <HomologCardImage src={panelImg} alt={n.card_name} variant="list" />
                    ) : null}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600}>
                      {n.card_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {n.source} · {n.notes}
                    </Typography>
                    <Button
                      size="small"
                      sx={{ mt: 0.5 }}
                      onClick={() => resolveNovedad.mutate(n.novedad_id)}
                      disabled={resolveNovedad.isPending}
                    >
                      Resolver
                    </Button>
                    </Box>
                  </Paper>
                );
                })}
              </Stack>
            )}
          </Paper>
        </Stack>
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
