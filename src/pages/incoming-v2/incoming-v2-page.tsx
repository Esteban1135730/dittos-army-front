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
  type PanelHomologItem,
  type PanelMatchCandidate,
  type SentHomologUnit,
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

const API_CARDTRADER = apiUrl('/cardtrader');

function unitStatusColor(status: SentHomologUnit['status']) {
  if (status === 'verified') return 'success';
  if (status === 'novedad') return 'warning';
  return 'default';
}

function CandidateRow(props: {
  candidate: PanelMatchCandidate;
  onSelect: () => void;
  disabled?: boolean;
  imageSrc?: string;
}) {
  const { candidate, onSelect, disabled, imageSrc } = props;
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        borderColor: candidate.matchTier === 'best' ? '#1565c0' : '#e0e0e0',
        bgcolor: candidate.matchTier === 'best' ? '#e3f2fd' : '#fff',
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
              label={candidate.matchTier === 'best' ? 'Match completo' : 'Posible'}
              color={candidate.matchTier === 'best' ? 'primary' : 'default'}
            />
            <Chip
              size="small"
              variant="outlined"
              label={`Disp. ${candidate.availableInSession}`}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary" display="block">
            Lote {formatHomologDate(candidate.batchPurchaseDate)} · {candidate.language}
            {candidate.rareza ? ` · ${candidate.rareza}` : ''}
          </Typography>
        </Box>
        <PanelItemPrices
          unitCostCop={candidate.unitCostCop}
          eurUnitPrice={candidate.eurUnitPrice}
          eurTotalLot={candidate.eurTotalLot}
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
  const { data: activeData, isLoading: activeLoading } = useHomologActive();
  const { data: novedades = [] } = useHomologNovedades();
  const {
    createSession,
    syncSent,
    verifyUnit,
    markNovedad,
    undoUnit,
    createTanda,
    cancelSession,
    resolveNovedad,
    axiosMessage,
  } = useHomologMutations();

  const session = activeData?.session;
  const panelItems = activeData?.panel_items ?? [];
  const batchesSummary = activeData?.batches_summary ?? [];
  const sessionId = session?.session_id;

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [novedadOpen, setNovedadOpen] = useState(false);
  const [appliedSentSearch, setAppliedSentSearch] = useState('');
  const [appliedInventorySearch, setAppliedInventorySearch] = useState('');

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

  const panelImageByBatchItemId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of panelItems) {
      const src = resolvePanelImageSrc(p.image_url);
      if (src) map.set(p.batch_item_id, src);
    }
    return map;
  }, [panelItems]);

  const panelItemByBatchItemId = useMemo(() => {
    return new Map(panelItems.map((p) => [p.batch_item_id, p]));
  }, [panelItems]);

  const summary = session?.summary ?? {
    total: 0,
    pending: 0,
    verified: 0,
    novedad: 0,
  };

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

  const bestCandidates = candidates.filter((c) => c.matchTier === 'best');
  const possibleCandidates = candidates.filter((c) => c.matchTier === 'possible');

  const selectedSentImage = selectedUnit
    ? resolveBlueprintImageSrc(selectedUnit.blueprint_id, blueprintImages)
    : undefined;

  const selectedPanelImage = selectedUnit?.batch_item_id
    ? panelImageByBatchItemId.get(selectedUnit.batch_item_id)
    : undefined;

  const selectedPanelItem = selectedUnit?.batch_item_id
    ? panelItemByBatchItemId.get(selectedUnit.batch_item_id)
    : undefined;

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
      map.set(p.batch_item_id, buildPanelItemSearchHaystack(p));
    }
    return map;
  }, [panelItems]);

  const filteredSentUnits = useMemo(
    () =>
      filterByHomologSearch(
        units,
        (u) => sentSearchHaystackByKey.get(u.sent_unit_key) ?? '',
        appliedSentSearch,
      ),
    [units, appliedSentSearch, sentSearchHaystackByKey],
  );

  const filteredPanelItems = useMemo(
    () =>
      filterByHomologSearch(
        panelItems,
        (p) => panelSearchHaystackById.get(p.batch_item_id) ?? '',
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
        batchItemId: candidate.batchItemId,
        matchScore: candidate.structuralScore,
      });
    } catch (e) {
      setError(axiosMessage(e));
    }
  };

  const handleNovedadSubmit = async (payload: {
    notes: string;
    batchItemId?: string;
  }) => {
    if (!sessionId || !selectedUnit) return;
    setError(null);
    try {
      await markNovedad.mutateAsync({
        sessionId,
        sentUnitKey: selectedUnit.sent_unit_key,
        notes: payload.notes,
        batchItemId: payload.batchItemId,
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
        batchItemId: item.batch_item_id,
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
    setError(null);
    try {
      const cards = buildCreateTandaCardsPayload(units, panelItems);
      const res = await createTanda.mutateAsync({
        sessionId,
        shipping_total_cop: shippingTotalCop,
        cards,
      });
      navigate(`/incoming/ship-round/${res.round_id}`);
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
          Compras en camino v2
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

  if (session.status === 'converted' && session.ship_round_id) {
    return (
      <Box maxWidth={720} mx="auto">
        <Alert severity="success" sx={{ mb: 2 }}>
          Esta sesión ya generó la tanda{' '}
          <strong>{session.ship_round_id}</strong>.
        </Alert>
        <Button
          component={Link}
          to={`/incoming/ship-round/${session.ship_round_id}`}
          variant="contained"
        >
          Ir a revisar tanda
        </Button>
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
            Compras en camino v2
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

      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', lg: '360px 1fr 300px' }}
        gap={2}
      >
        {/* Lista sent */}
        <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 640, overflow: 'auto' }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            Cartas sent ({filteredSentUnits.length}
            {appliedSentSearch.trim() ? ` / ${units.length}` : ''})
          </Typography>
          <HomologSearchField
            placeholder="Buscar nombre, pedido, expansión… (Enter)"
            onApply={setAppliedSentSearch}
            sx={{ mb: 1.5 }}
          />
          <Stack spacing={1}>
            {filteredSentUnits.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                {appliedSentSearch.trim() ? 'Sin resultados.' : 'No hay cartas sent.'}
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
                  {u.batch_item_card_name ? (
                    <Typography variant="caption" color="success.main" display="block" noWrap>
                      → {u.batch_item_card_name}
                    </Typography>
                  ) : null}
                </Box>
                {u.status === 'verified' || u.status === 'novedad' ? (
                  <HomologPriceChip
                    cop={u.unit_cost_cop}
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
                      alt={selectedUnit.batch_item_card_name ?? 'Panel'}
                      variant="detail"
                    />
                  </Box>
                ) : null}
              </Stack>

              <Typography variant="h6" fontWeight={600} gutterBottom>
                {selectedUnit.name}
              </Typography>

              {(selectedUnit.status === 'verified' || selectedUnit.status === 'novedad') &&
              selectedUnit.unit_cost_cop != null ? (
                <Box mb={2}>
                  <HomologPriceBlock
                    cop={selectedUnit.unit_cost_cop}
                    fx={fxUnitPriceFromSentUnit(selectedUnit).amount}
                    currency={fxUnitPriceFromSentUnit(selectedUnit).currency}
                    copLabel="Precio de compra"
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
                  Homologada con <strong>{selectedUnit.batch_item_card_name}</strong>
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
                      Sin candidatos en tu inventario en camino. Marca novedad o revisa el
                      registro del panel.
                    </Alert>
                  ) : (
                    <Stack spacing={1.5}>
                      {bestCandidates.length > 0 ? (
                        <>
                          <Typography variant="subtitle2" fontWeight={600}>
                            Match completo
                          </Typography>
                          {bestCandidates.map((c) => (
                            <CandidateRow
                              key={c.batchItemId}
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
                              key={c.batchItemId}
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
              Cartas en camino ({filteredPanelItems.length}
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
                  const img = resolvePanelImageSrc(item.image_url);
                  const canPick =
                    selectedUnit?.status === 'pending' && item.available_in_session > 0;
                  return (
                    <Paper
                      key={item.batch_item_id}
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
                      <HomologCardImage src={img} alt={item.card_name} variant="list" />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {item.card_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {formatHomologDate(item.batch_purchase_date)} · {item.language}
                          {item.rareza ? ` · ${item.rareza}` : ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Disp. {item.available_in_session} / {item.remaining_quantity}
                        </Typography>
                      </Box>
                      <PanelItemPriceChip
                        unitCostCop={item.unit_cost_cop}
                        eurUnitPrice={item.eur_unit_price}
                        eurTotalLot={item.eur_total_lot}
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
              Lotes en camino ({batchesSummary.length})
            </Typography>
            {batchesSummary.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin lotes abiertos.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {batchesSummary.map((batch) => (
                  <Paper key={batch.batch_id} variant="outlined" sx={{ p: 1.25 }}>
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
                        eur={batch.total_eur_cards_cost}
                      />
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>

          <HomologCreateTandaPanel
            pendingCount={summary.pending}
            totalUnits={summary.total}
            isSubmitting={createTanda.isPending}
            onCreate={handleCreateTanda}
          />

          <Paper variant="outlined" sx={{ p: 2, maxHeight: 360, overflow: 'auto' }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Novedades en registro ({novedades.length})
            </Typography>
            {novedades.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Sin novedades abiertas.
              </Typography>
            ) : (
              <Stack spacing={1}>
                {novedades.map((n) => {
                  const panelImg = panelImageByBatchItemId.get(n.batch_item_id);
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
