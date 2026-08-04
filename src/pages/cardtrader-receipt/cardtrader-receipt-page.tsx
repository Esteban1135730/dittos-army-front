import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Step,
  StepButton,
  Stepper,
  Typography,
} from '@mui/material';
import {
  InconsistencyDialog,
} from './inconsistency-dialog';
import { ReceiptFinalizePanel } from './receipt-finalize-panel';
import { ReceiptLineRow } from './receipt-line-row';
import { ReceiptWizardLabelsStep } from './receipt-wizard-labels-step';
import { ReceiptWizardPvpStep } from './receipt-wizard-pvp-step';
import {
  axiosMessage,
  clearPersistedReceiptStockIds,
  persistReceiptStockIds,
  readPersistedReceiptStockIds,
  type InconsistencyType,
  type ReceiptLine,
  type ReceiptSession,
  type ReceiptWizardStep,
  useCancelReceiptSession,
  useCreateReceiptSession,
  useFinalizeReceipt,
  useMarkInconsistency,
  useReceiptActiveSession,
  useReceiptSession,
  useReceiveLine,
  useRevertFinalization,
  useUndoLine,
} from './use-receipt-session';

const STEP_LABELS = ['Recepción', 'Finalizar', 'Asignar PVP', 'Etiquetas'] as const;

function groupLinesByLot(lines: ReceiptLine[]): Map<string, ReceiptLine[]> {
  const map = new Map<string, ReceiptLine[]>();
  for (const line of lines) {
    const key = line.transit_lot_id || 'sin-lote';
    const list = map.get(key) ?? [];
    list.push(line);
    map.set(key, list);
  }
  return map;
}

function stockIdsFromSession(session: ReceiptSession | null | undefined): string[] {
  if (!session) return [];
  return session.lines
    .filter((l) => l.status === 'received' && l.stock_id)
    .map((l) => l.stock_id as string);
}

export default function CardtraderReceiptPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const stepParam = Number(searchParams.get('step') || '0');
  const sessionParam = searchParams.get('session') || undefined;

  const {
    data: activeSession,
    isLoading: activeLoading,
    error: activeError,
  } = useReceiptActiveSession();

  const finalizedSessionId =
    !activeSession && sessionParam ? sessionParam : undefined;
  const { data: finalizedSession, isLoading: finalizedLoading } =
    useReceiptSession(finalizedSessionId);

  const session: ReceiptSession | null =
    activeSession ??
    (finalizedSession?.status === 'finalized' ? finalizedSession : null) ??
    null;

  const sessionId = session?.session_id ?? '';

  const [wizardStep, setWizardStep] = useState<ReceiptWizardStep>(1);
  const [stockIds, setStockIds] = useState<string[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [inconsistencyLine, setInconsistencyLine] = useState<ReceiptLine | null>(
    null,
  );
  const [createBusy, setCreateBusy] = useState(false);

  const createSession = useCreateReceiptSession();
  const receiveLine = useReceiveLine(sessionId);
  const markInconsistency = useMarkInconsistency(sessionId);
  const undoLine = useUndoLine(sessionId);
  const finalizeReceipt = useFinalizeReceipt(sessionId);
  const cancelSession = useCancelReceiptSession(sessionId);
  const revertFinalization = useRevertFinalization(sessionId);

  // Sync step from session / query
  useEffect(() => {
    if (activeLoading || finalizedLoading) return;

    if (session?.status === 'finalized') {
      const fromLines = stockIdsFromSession(session);
      const persisted = readPersistedReceiptStockIds(session.session_id);
      const ids = fromLines.length > 0 ? fromLines : persisted ?? [];
      setStockIds(ids);
      const requested =
        stepParam === 3 || stepParam === 4 ? (stepParam as ReceiptWizardStep) : 3;
      setWizardStep(requested);
      return;
    }

    if (session?.status === 'open') {
      if (stepParam === 2) {
        setWizardStep(2);
      } else if (wizardStep > 2) {
        setWizardStep(1);
      }
      return;
    }

    if (!session) {
      setWizardStep(1);
      setStockIds([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to session/query changes
  }, [
    activeLoading,
    finalizedLoading,
    session?.session_id,
    session?.status,
    stepParam,
  ]);

  const lotGroups = useMemo((): Map<string, ReceiptLine[]> => {
    return session ? groupLinesByLot(session.lines) : new Map();
  }, [session]);

  const canReachStep3 =
    session?.status === 'finalized' || stockIds.length > 0 || !!sessionParam;

  const goToStep = (step: ReceiptWizardStep) => {
    if (step >= 3 && !canReachStep3 && session?.status !== 'finalized') return;
    setWizardStep(step);
    const next = new URLSearchParams(searchParams);
    next.set('step', String(step));
    if (sessionId) next.set('session', sessionId);
    setSearchParams(next, { replace: true });
  };

  const handleCreate = async () => {
    setActionError(null);
    setCreateBusy(true);
    try {
      await createSession.mutateAsync();
      setStockIds([]);
      setWizardStep(1);
      setSearchParams({}, { replace: true });
    } catch (e) {
      setActionError(axiosMessage(e));
    } finally {
      setCreateBusy(false);
    }
  };

  const handleReceive = async (lineId: string, qty: number) => {
    setActionError(null);
    try {
      await receiveLine.mutateAsync({ lineId, received_qty: qty });
    } catch (e) {
      setActionError(axiosMessage(e));
      throw e;
    }
  };

  const handleInconsistency = async (
    lineId: string,
    type: InconsistencyType,
    notes: string,
  ) => {
    setActionError(null);
    try {
      await markInconsistency.mutateAsync({ lineId, type, notes });
    } catch (e) {
      setActionError(axiosMessage(e));
      throw e;
    }
  };

  const handleUndo = async (lineId: string) => {
    setActionError(null);
    try {
      await undoLine.mutateAsync(lineId);
    } catch (e) {
      setActionError(axiosMessage(e));
      throw e;
    }
  };

  const handleFinalize = async (shippingCop: number) => {
    setActionError(null);
    try {
      const result = await finalizeReceipt.mutateAsync(shippingCop);
      const ids = Array.isArray(result.stock_ids) ? result.stock_ids : [];
      setStockIds(ids);
      persistReceiptStockIds(result.session_id, ids);
      setWizardStep(3);
      setSearchParams(
        {
          step: '3',
          session: result.session_id,
        },
        { replace: true },
      );
    } catch (e) {
      setActionError(axiosMessage(e));
      throw e;
    }
  };

  const handleCancel = async () => {
    setActionError(null);
    try {
      await cancelSession.mutateAsync();
      setStockIds([]);
      setWizardStep(1);
      setSearchParams({}, { replace: true });
    } catch (e) {
      setActionError(axiosMessage(e));
    }
  };

  const handleRevert = async () => {
    setActionError(null);
    try {
      await revertFinalization.mutateAsync();
      if (sessionId) clearPersistedReceiptStockIds(sessionId);
      setStockIds([]);
      setWizardStep(1);
      setSearchParams({}, { replace: true });
    } catch (e) {
      setActionError(axiosMessage(e));
      throw e;
    }
  };

  const handleFinishWizard = () => {
    if (sessionId) clearPersistedReceiptStockIds(sessionId);
    setStockIds([]);
    setWizardStep(1);
    setSearchParams({}, { replace: true });
  };

  const loading = activeLoading || (!!finalizedSessionId && finalizedLoading);

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto', pb: 4 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        flexWrap="wrap"
        gap={1}
        mb={2}
      >
        <Typography variant="h5" fontWeight={700}>
          Recepción CT
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button component={Link} to="/cardtrader-transit" size="small">
            Lotes en tránsito
          </Button>
          <Button component={Link} to="/incoming-v2" size="small" color="inherit">
            Homologación (Compras v2)
          </Button>
        </Stack>
      </Stack>

      <Stepper nonLinear activeStep={wizardStep - 1} sx={{ mb: 3 }}>
        {STEP_LABELS.map((label, index) => {
          const stepNum = (index + 1) as ReceiptWizardStep;
          const disabled =
            stepNum >= 3 &&
            session?.status !== 'finalized' &&
            stockIds.length === 0 &&
            !sessionParam;
          return (
            <Step key={label} completed={wizardStep > stepNum}>
              <StepButton
                disabled={disabled}
                onClick={() => goToStep(stepNum)}
              >
                {label}
              </StepButton>
            </Step>
          );
        })}
      </Stepper>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {activeError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {axiosMessage(activeError)}
        </Alert>
      )}

      {loading ? (
        <Box py={6} display="flex" justifyContent="center">
          <CircularProgress />
        </Box>
      ) : !session ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            No hay sesión de recepción activa
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={2}>
            Inicia una recepción para cargar las líneas de tránsito abiertas
            (remaining &gt; 0).
          </Typography>
          <Button
            variant="contained"
            onClick={() => void handleCreate()}
            disabled={createBusy}
          >
            {createBusy ? 'Iniciando…' : 'Iniciar recepción'}
          </Button>
        </Paper>
      ) : (
        <>
          {(wizardStep === 1 || wizardStep === 2) &&
            session.status === 'open' && (
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                alignItems="flex-start"
              >
                <Box flex={1} minWidth={0}>
                  {wizardStep === 1 && (
                    <>
                      <Typography variant="subtitle1" fontWeight={600} mb={1}>
                        Líneas por lote
                      </Typography>
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        Pendientes: {session.summary.pending} · Recibidas:{' '}
                        {session.summary.received} · Inconsistencias:{' '}
                        {session.summary.inconsistency}
                      </Typography>
                      {[...lotGroups.entries()].map(([lotId, lines]) => (
                        <Accordion key={lotId} defaultExpanded>
                          <AccordionSummary>
                            <Typography variant="subtitle2">
                              Lote {lotId} ({lines.length})
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ p: 0 }}>
                            {lines.map((line) => (
                              <Box key={line.line_id}>
                                <ReceiptLineRow
                                  line={line}
                                  onReceive={handleReceive}
                                  onInconsistency={(l) => setInconsistencyLine(l)}
                                  onUndo={handleUndo}
                                />
                                <Divider />
                              </Box>
                            ))}
                          </AccordionDetails>
                        </Accordion>
                      ))}
                      <Button
                        sx={{ mt: 2 }}
                        variant="outlined"
                        onClick={() => goToStep(2)}
                      >
                        Ir a Finalizar
                      </Button>
                    </>
                  )}
                  {wizardStep === 2 && (
                    <Alert severity="info">
                      Revisa el resumen a la derecha e ingresa el costo de envío
                      para crear el inventario.
                    </Alert>
                  )}
                </Box>
                <Box width={{ xs: '100%', md: 320 }} flexShrink={0}>
                  <ReceiptFinalizePanel
                    session={session}
                    onFinalize={handleFinalize}
                    onCancel={handleCancel}
                    error={actionError}
                  />
                  {wizardStep === 2 && (
                    <Button
                      sx={{ mt: 1 }}
                      fullWidth
                      variant="text"
                      onClick={() => goToStep(1)}
                    >
                      Volver a Recepción
                    </Button>
                  )}
                </Box>
              </Stack>
            )}

          {wizardStep === 3 && (
            <ReceiptWizardPvpStep
              sessionId={session.session_id}
              lines={session.lines}
              onContinue={() => goToStep(4)}
              onSkip={() => goToStep(4)}
              onRevert={handleRevert}
            />
          )}

          {wizardStep === 4 && (
            <ReceiptWizardLabelsStep
              stockIds={
                stockIds.length > 0
                  ? stockIds
                  : stockIdsFromSession(session)
              }
              onFinish={handleFinishWizard}
              onNewReceipt={() => void handleCreate()}
              onRevert={handleRevert}
            />
          )}
        </>
      )}

      <InconsistencyDialog
        open={Boolean(inconsistencyLine)}
        line={inconsistencyLine}
        onConfirm={handleInconsistency}
        onClose={() => setInconsistencyLine(null)}
      />
    </Box>
  );
}
