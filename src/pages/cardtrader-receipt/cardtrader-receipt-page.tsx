import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Step,
  StepButton,
  Stepper,
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
import { useExchangeRates } from '../../utils/tasa';
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
import { useArrivalTracking } from './use-arrival-tracking';
import { exportSentUnitsByBlueprintToPdf } from './export-sent-units-pdf';
import { ReceiptWizardLabelsStep } from './receipt-wizard-labels-step';
import { ReceiptWizardPvpStep } from './receipt-wizard-pvp-step';
import {
  groupSentHomologUnitsByBlueprint,
  pickFocusSentUnit,
} from '../../modules/receipt-wizard';
import {
  clearPersistedReceiptStockIds,
  persistReceiptStockIds,
  readPersistedReceiptStockIds,
  type ReceiptWizardStep,
} from './use-receipt-session';

type ArrivalFilter = 'all' | 'arrived' | 'not_arrived';

const STEP_LABELS = ['Envío', 'Stock', 'PVP', 'Etiquetas'] as const;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { rates } = useExchangeRates();
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
  const {
    isArrived,
    toggleArrived,
    markMany,
    unmarkMany,
  } = useArrivalTracking(sessionId);

  const stepParam = Number(searchParams.get('step') || '0');
  const [wizardStep, setWizardStep] = useState<ReceiptWizardStep>(1);
  const [stockIds, setStockIds] = useState<string[]>([]);
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
  const [arrivalFilter, setArrivalFilter] = useState<ArrivalFilter>('all');

  const units = session?.units ?? [];
  const summary = session?.summary ?? { total: 0, pending: 0, verified: 0, novedad: 0 };
  const { blueprintImages, imagesLoading } = useHomologBlueprintImages(units);
  const systemTrm = useMemo(
    () => ({
      euroToCop: rates.euroToCop,
      usdToCop: rates.usdToCop,
    }),
    [rates.euroToCop, rates.usdToCop],
  );

  const resolveStockIds = (sid: string | undefined): string[] => {
    if (!sid) return [];
    const fromSession = session?.created_stock_ids;
    if (Array.isArray(fromSession) && fromSession.length > 0) return fromSession;
    return readPersistedReceiptStockIds(sid) ?? [];
  };

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      setWizardStep(1);
      setStockIds([]);
      return;
    }
    if (session.status === 'converted') {
      const ids = resolveStockIds(session.session_id);
      setStockIds(ids);
      const requested =
        stepParam === 3 || stepParam === 4
          ? (stepParam as ReceiptWizardStep)
          : 3;
      setWizardStep(requested);
      return;
    }
    if (stepParam === 2) {
      setWizardStep(2);
    } else if (stepParam === 1 || !stepParam) {
      setWizardStep(1);
    } else if (stepParam >= 3) {
      setWizardStep(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session/query driven
  }, [
    isLoading,
    session?.session_id,
    session?.status,
    session?.created_stock_ids,
    stepParam,
  ]);

  const goToStep = (step: ReceiptWizardStep) => {
    if (step >= 3 && session?.status !== 'converted' && stockIds.length === 0) {
      return;
    }
    if (step <= 2 && session?.status === 'converted') {
      return;
    }
    setWizardStep(step);
    const next = new URLSearchParams(searchParams);
    next.set('step', String(step));
    if (sessionId) next.set('session', sessionId);
    setSearchParams(next, { replace: true });
  };

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
    const bySearch = filterByHomologSearch(
      base,
      (u) => sentSearchHaystackByKey.get(u.sent_unit_key) ?? '',
      appliedSentSearch,
    );
    if (arrivalFilter === 'arrived') {
      return bySearch.filter((u) => isArrived(u.sent_unit_key));
    }
    if (arrivalFilter === 'not_arrived') {
      return bySearch.filter((u) => !isArrived(u.sent_unit_key));
    }
    return bySearch;
  }, [
    units,
    appliedSentSearch,
    sentSearchHaystackByKey,
    sentStatusFilter,
    arrivalFilter,
    isArrived,
  ]);

  const filteredSentGroups = useMemo(
    () => groupSentHomologUnitsByBlueprint(filteredSentUnits),
    [filteredSentUnits],
  );

  const arrivedInSessionCount = useMemo(
    () => units.filter((u) => isArrived(u.sent_unit_key)).length,
    [units, isArrived],
  );

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
      const cards = buildCreateTandaCardsPayload(units, panelItems, systemTrm);
      const res = await createTanda.mutateAsync({
        sessionId,
        shipping_total_cop: shippingTotalCop,
        cards,
      });
      const ids = Array.isArray(res.stock_ids) ? res.stock_ids : [];
      setStockIds(ids);
      persistReceiptStockIds(sessionId, ids);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['incoming-homolog-active'] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
      ]);
      // Legacy ship-round path: still allow deep-link, but CT receipt continues wizard.
      if (res.round_id && ids.length === 0) {
        navigate(`/incoming/ship-round/${res.round_id}`);
        return;
      }
      setWizardStep(3);
      setSearchParams(
        { step: '3', session: sessionId },
        { replace: true },
      );
      setInfo(
        `Stock creado: ${res.stock_created ?? ids.length} unidad(es). Continúa con PVP.`,
      );
    } catch (e) {
      setError(axiosMsg(e));
    }
  };

  const handleRevertConversion = async () => {
    if (!sessionId) return;
    setError(null);
    try {
      await revertConversion.mutateAsync(sessionId);
      clearPersistedReceiptStockIds(sessionId);
      setStockIds([]);
      setWizardStep(1);
      setSearchParams({}, { replace: true });
    } catch (e) {
      setError(axiosMsg(e));
      throw e;
    }
  };

  const handleFinishWizard = () => {
    if (sessionId) clearPersistedReceiptStockIds(sessionId);
    setStockIds([]);
    setWizardStep(1);
    setSearchParams({}, { replace: true });
  };

  const handleNewReceipt = async () => {
    setError(null);
    try {
      if (sessionId) clearPersistedReceiptStockIds(sessionId);
      await createSession.mutateAsync();
      setStockIds([]);
      setWizardStep(1);
      setSearchParams({}, { replace: true });
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        await queryClient.invalidateQueries({ queryKey: ['incoming-homolog-active'] });
        return;
      }
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

  const pageHeader = (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      spacing={1.5}
      mb={2}
    >
      <Box>
        <Typography variant="h5" fontWeight={700}>
          Recepción CT
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Registra el envío de CardTrader como stock, luego PVP y etiquetas.
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button component={Link} to="/cardtrader-transit" size="small" variant="text">
          Tránsito
        </Button>
        <Button component={Link} to="/incoming-v2" size="small" variant="text">
          Homologación avanzada
        </Button>
      </Stack>
    </Stack>
  );

  const stepper = (
    <Paper variant="outlined" sx={{ px: { xs: 1, sm: 2 }, py: 1.5, mb: 2 }}>
      <Stepper nonLinear activeStep={wizardStep - 1} alternativeLabel>
        {STEP_LABELS.map((label, index) => {
          const stepNum = (index + 1) as ReceiptWizardStep;
          const disabled =
            (stepNum >= 3 &&
              session?.status !== 'converted' &&
              stockIds.length === 0) ||
            (stepNum <= 2 && session?.status === 'converted');
          return (
            <Step key={label} completed={wizardStep > stepNum}>
              <StepButton disabled={disabled} onClick={() => goToStep(stepNum)}>
                {label}
              </StepButton>
            </Step>
          );
        })}
      </Stepper>
    </Paper>
  );

  if (isLoading) {
    return (
      <Box sx={{ maxWidth: 1280, mx: 'auto', pb: 4, px: { xs: 1, sm: 0 } }}>
        {pageHeader}
        {stepper}
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (!session) {
    return (
      <Box sx={{ maxWidth: 1280, mx: 'auto', pb: 4, px: { xs: 1, sm: 0 } }}>
        {pageHeader}
        {stepper}
        <Paper variant="outlined" sx={{ p: 3, maxWidth: 560 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Sin sesión activa
          </Typography>
          <Typography color="text.secondary" paragraph>
            Empieza por el envío actual de CardTrader: sincronizas las cartas{' '}
            <strong>sent</strong>, las cruzas con tránsito y las pasas a stock.
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
            {createSession.isPending ? 'Iniciando…' : 'Iniciar recepción'}
          </Button>
        </Paper>
      </Box>
    );
  }

  if (session.status === 'converted') {
    const ids =
      stockIds.length > 0 ? stockIds : resolveStockIds(session.session_id);
    const step: ReceiptWizardStep =
      wizardStep === 4 ? 4 : 3;
    return (
      <Box sx={{ maxWidth: 1280, mx: 'auto', pb: 4, px: { xs: 1, sm: 0 } }}>
        {pageHeader}
        {stepper}
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
        {step === 3 ? (
          <ReceiptWizardPvpStep
            sessionId={session.session_id}
            stockIds={ids}
            onContinue={() => goToStep(4)}
            onSkip={() => goToStep(4)}
            onRevert={handleRevertConversion}
          />
        ) : (
          <ReceiptWizardLabelsStep
            stockIds={ids}
            onFinish={handleFinishWizard}
            onNewReceipt={() => void handleNewReceipt()}
            onRevert={handleRevertConversion}
          />
        )}
      </Box>
    );
  }

  const selectedSentImage = selectedUnit
    ? resolveBlueprintImageSrc(selectedUnit.blueprint_id, blueprintImages)
    : undefined;

  const readyForStock =
    summary.pending === 0 && summary.verified > 0 && units.length > 0;

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', pb: 4, px: { xs: 1, sm: 0 } }}>
      {pageHeader}
      {stepper}

      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          mb: 2,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
          justifyContent: 'space-between',
        }}
      >
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip
            label={`${summary.verified} verificadas`}
            color="success"
            size="small"
          />
          <Chip label={`${summary.pending} pendientes`} size="small" />
          {summary.novedad > 0 ? (
            <Chip
              label={`${summary.novedad} novedad`}
              color="warning"
              size="small"
            />
          ) : null}
          <Chip
            label={`${arrivedInSessionCount}/${units.length} llegadas`}
            color={arrivedInSessionCount > 0 ? 'success' : 'default'}
            size="small"
            variant="outlined"
          />
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            size="small"
            variant="contained"
            onClick={() => void handleSyncAndAutoMatch()}
            disabled={isBusy}
          >
            {syncSent.isPending || autoVerify.isPending
              ? 'Sincronizando…'
              : 'Sincronizar envío'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => void handleExportPdf()}
            disabled={isBusy || exportingPdf || units.length === 0 || imagesLoading}
          >
            {exportingPdf
              ? 'PDF…'
              : imagesLoading
                ? 'Imágenes…'
                : 'Exportar PDF'}
          </Button>
          <Button
            size="small"
            color="error"
            variant="text"
            onClick={() => void handleCancelAndRestart()}
            disabled={isBusy || cancelSession.isPending || createSession.isPending}
          >
            Nueva sesión
          </Button>
        </Stack>
      </Paper>

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

      {wizardStep === 2 ? (
        <Box mb={2}>
          <Alert severity="info" sx={{ mb: 2 }}>
            {summary.verified} carta(s) verificada(s) del envío listas para pasar a
            stock. Ingresa el costo de envío total.
          </Alert>
          <HomologCreateTandaPanel
            pendingCount={summary.pending}
            totalUnits={summary.total}
            verifiedCount={summary.verified}
            isSubmitting={createTanda.isPending}
            onCreate={handleCreateTanda}
            title="Crear stock del envío"
            description="Solo entran las cartas verificadas de este envío CT. El resto del tránsito no se toca."
            createButtonLabel="Crear stock y continuar a PVP"
          />
          <Button sx={{ mt: 1.5 }} variant="text" onClick={() => goToStep(1)}>
            Volver al envío
          </Button>
        </Box>
      ) : null}

      {wizardStep === 1 && units.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Aún no hay cartas del envío. Pulsa <strong>Sincronizar envío</strong> para
          traer las unidades <em>sent</em> de CardTrader.
        </Alert>
      ) : null}

      {wizardStep === 1 && readyForStock ? (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" variant="outlined" onClick={() => goToStep(2)}>
              Continuar a Stock
            </Button>
          }
        >
          Todas las cartas del envío están resueltas ({summary.verified} verificadas
          {summary.novedad > 0 ? `, ${summary.novedad} novedad` : ''}).
        </Alert>
      ) : null}

      {wizardStep === 1 ? (
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', lg: 'minmax(300px, 360px) minmax(0, 1fr) minmax(260px, 320px)' }}
        gap={2}
        alignItems="start"
      >
        {/* Columna 1: sent units */}
        <Paper
          variant="outlined"
          sx={{
            p: 1.5,
            maxHeight: { lg: 'calc(100vh - 260px)' },
            overflow: 'auto',
            position: { lg: 'sticky' },
            top: { lg: 16 },
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Cartas del envío
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            {filteredSentGroups.length} carta(s) · {filteredSentUnits.length} ud. ·
            agrupado por blueprint
          </Typography>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
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
            <Chip
              label="Sin llegar"
              size="small"
              clickable
              color={arrivalFilter === 'not_arrived' ? 'primary' : 'default'}
              variant={arrivalFilter === 'not_arrived' ? 'filled' : 'outlined'}
              onClick={() =>
                setArrivalFilter((prev) =>
                  prev === 'not_arrived' ? 'all' : 'not_arrived',
                )
              }
            />
            <Chip
              label="Llegadas"
              size="small"
              clickable
              color={arrivalFilter === 'arrived' ? 'success' : 'default'}
              variant={arrivalFilter === 'arrived' ? 'filled' : 'outlined'}
              onClick={() =>
                setArrivalFilter((prev) => (prev === 'arrived' ? 'all' : 'arrived'))
              }
            />
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <HomologSearchField
              placeholder="Buscar nombre, pedido…"
              onApply={setAppliedSentSearch}
              sx={{ flex: 1, mb: 0 }}
            />
            <Button
              size="small"
              variant="outlined"
              disabled={filteredSentUnits.every((u) => isArrived(u.sent_unit_key))}
              onClick={() =>
                markMany(filteredSentUnits.map((u) => u.sent_unit_key))
              }
              sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Marcar visibles
            </Button>
          </Stack>
          <Stack spacing={1}>
            {filteredSentGroups.map((group) => {
              const focus = pickFocusSentUnit(group.units, (k) =>
                perfectMatchBySentKey.get(k) === true,
              );
              const thumbSrc = resolveBlueprintImageSrc(
                group.blueprintId ?? focus?.blueprint_id,
                blueprintImages,
              );
              const hasPerfect = group.units.some(
                (u) => perfectMatchBySentKey.get(u.sent_unit_key) === true,
              );
              const isSelected = group.units.some(
                (u) => u.sent_unit_key === selectedKey,
              );
              const arrivedCount = group.units.filter((u) =>
                isArrived(u.sent_unit_key),
              ).length;
              const allArrived = arrivedCount === group.units.length;
              const someArrived = arrivedCount > 0 && !allArrived;
              const pendingCount = group.units.filter(
                (u) => u.status === 'pending',
              ).length;
              const verifiedCount = group.units.filter(
                (u) => u.status === 'verified',
              ).length;
              const multi = group.units.length > 1;
              const statusLabel =
                pendingCount > 0
                  ? `${pendingCount} pend.`
                  : verifiedCount === group.units.length
                    ? 'verified'
                    : group.units[0]?.status ?? '';
              return (
                <Paper
                  key={group.key}
                  variant="outlined"
                  sx={{
                    p: 1,
                    borderWidth: hasPerfect || isSelected ? 2 : 1,
                    borderColor: isSelected
                      ? 'primary.main'
                      : hasPerfect
                        ? 'success.main'
                        : allArrived
                          ? 'success.light'
                          : 'divider',
                    bgcolor: isSelected
                      ? 'action.selected'
                      : allArrived
                        ? '#f1f8e9'
                        : hasPerfect
                          ? '#e8f5e9'
                          : 'background.paper',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 1,
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                    }}
                    onClick={() => {
                      if (focus) setSelectedKey(focus.sent_unit_key);
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={allArrived}
                      indeterminate={someArrived}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => {
                        const keys = group.units.map((u) => u.sent_unit_key);
                        if (allArrived) unmarkMany(keys);
                        else markMany(keys.filter((k) => !isArrived(k)));
                      }}
                      inputProps={{
                        'aria-label': multi
                          ? 'Marcar todas las unidades como llegadas'
                          : 'Marcar como llegada',
                      }}
                      sx={{ p: 0.5, flexShrink: 0, mt: 0.25 }}
                    />
                    <HomologCardImage
                      src={thumbSrc}
                      alt={group.name}
                      variant="list"
                      loading={
                        imagesLoading && !!group.blueprintId && !thumbSrc
                      }
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        gap={0.5}
                        alignItems="center"
                      >
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          noWrap
                          sx={{
                            textDecoration: allArrived
                              ? 'line-through'
                              : undefined,
                            color: allArrived ? 'text.secondary' : undefined,
                          }}
                        >
                          {group.name}
                        </Typography>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {multi ? (
                            <Chip
                              size="small"
                              label={`${arrivedCount}/${group.units.length} lleg.`}
                              color={
                                allArrived
                                  ? 'success'
                                  : someArrived
                                    ? 'warning'
                                    : 'default'
                              }
                              variant={allArrived ? 'filled' : 'outlined'}
                              sx={{ height: 22, fontWeight: 700 }}
                            />
                          ) : null}
                          {hasPerfect && pendingCount > 0 ? (
                            <Chip
                              size="small"
                              color="success"
                              label="Match"
                              sx={{ fontWeight: 700, height: 22 }}
                            />
                          ) : (
                            <Chip
                              size="small"
                              color={
                                pendingCount > 0
                                  ? 'default'
                                  : verifiedCount === group.units.length
                                    ? 'success'
                                    : 'warning'
                              }
                              label={statusLabel}
                            />
                          )}
                        </Stack>
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        display="block"
                        noWrap
                      >
                        {focus?.order_code}
                        {group.blueprintId ? ` · BP#${group.blueprintId}` : ''}
                        {focus?.rareza ? ` · ${focus.rareza}` : ''}
                        {multi ? ` · ×${group.units.length} ud.` : ''}
                      </Typography>
                      {verifiedCount > 0 && pendingCount > 0 ? (
                        <Typography
                          variant="caption"
                          color="success.main"
                          display="block"
                          noWrap
                        >
                          {verifiedCount}/{group.units.length} verificadas
                        </Typography>
                      ) : focus?.transit_line_card_name && !multi ? (
                        <Typography
                          variant="caption"
                          color="success.main"
                          display="block"
                          noWrap
                        >
                          → {focus.transit_line_card_name}
                        </Typography>
                      ) : hasPerfect && pendingCount > 0 && !multi ? (
                        <Typography
                          variant="caption"
                          color="success.dark"
                          display="block"
                          noWrap
                          fontWeight={600}
                        >
                          Match perfecto disponible
                        </Typography>
                      ) : null}
                    </Box>
                    {focus && !multi ? (
                      <Typography
                        variant="caption"
                        fontWeight={600}
                        color={hasPerfect ? 'success.dark' : 'text.secondary'}
                        sx={{ whiteSpace: 'nowrap', mt: 0.5 }}
                      >
                        {formatFx(
                          fxUnitPriceFromSentUnit(focus).amount,
                          fxUnitPriceFromSentUnit(focus).currency,
                        )}
                      </Typography>
                    ) : null}
                  </Box>

                  {multi ? (
                    <Stack
                      spacing={0.5}
                      sx={{ mt: 1, ml: 5.5, pl: 0.5 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        fontWeight={600}
                      >
                        Unidades (marca llegada una a una si el lote no está completo)
                      </Typography>
                      {group.units.map((u, idx) => {
                        const unitArrived = isArrived(u.sent_unit_key);
                        const unitSelected = selectedKey === u.sent_unit_key;
                        const unitPerfect =
                          perfectMatchBySentKey.get(u.sent_unit_key) === true;
                        return (
                          <Box
                            key={u.sent_unit_key}
                            onClick={() => setSelectedKey(u.sent_unit_key)}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              py: 0.35,
                              px: 0.75,
                              borderRadius: 1,
                              cursor: 'pointer',
                              bgcolor: unitSelected
                                ? 'action.selected'
                                : 'transparent',
                              border: '1px solid',
                              borderColor: unitSelected
                                ? 'primary.main'
                                : 'divider',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                          >
                            <Checkbox
                              size="small"
                              checked={unitArrived}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleArrived(u.sent_unit_key)}
                              inputProps={{
                                'aria-label': `Unidad ${idx + 1} llegada`,
                              }}
                              sx={{ p: 0.25 }}
                            />
                            <Typography
                              variant="caption"
                              fontWeight={600}
                              sx={{
                                minWidth: 28,
                                textDecoration: unitArrived
                                  ? 'line-through'
                                  : undefined,
                                color: unitArrived
                                  ? 'text.secondary'
                                  : 'text.primary',
                              }}
                            >
                              #{idx + 1}
                            </Typography>
                            <Chip
                              size="small"
                              color={unitStatusColor(u.status)}
                              label={u.status}
                              sx={{ height: 20, fontSize: 10 }}
                            />
                            {unitPerfect && u.status === 'pending' ? (
                              <Chip
                                size="small"
                                color="success"
                                label="Match"
                                sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                              />
                            ) : null}
                            {u.transit_line_card_name ? (
                              <Typography
                                variant="caption"
                                color="success.main"
                                noWrap
                                sx={{ flex: 1, minWidth: 0 }}
                              >
                                → {u.transit_line_card_name}
                              </Typography>
                            ) : (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                noWrap
                                sx={{ flex: 1, minWidth: 0 }}
                              >
                                {u.order_code}
                              </Typography>
                            )}
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ whiteSpace: 'nowrap' }}
                            >
                              {formatFx(
                                fxUnitPriceFromSentUnit(u).amount,
                                fxUnitPriceFromSentUnit(u).currency,
                              )}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Stack>
                  ) : null}
                </Paper>
              );
            })}
          </Stack>
        </Paper>

        {/* Columna 2: detalle + candidatas rankeadas */}
        <Paper variant="outlined" sx={{ p: 2, minHeight: 400 }}>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Detalle y match
          </Typography>
          {!selectedUnit ? (
            <Typography color="text.secondary">
              Selecciona una carta del envío (columna izquierda) para ver candidatas.
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
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            maxHeight: { lg: 'calc(100vh - 260px)' },
            overflow: 'auto',
            position: { lg: 'sticky' },
            top: { lg: 16 },
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            Tránsito disponible
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            {rankedTransitBrowse.length}/{panelItems.length} · clic para asignar a la carta
            seleccionada
          </Typography>
          <HomologSearchField
            placeholder="Buscar en tránsito…"
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
      ) : null}

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
