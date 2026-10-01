import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { LoadingScreen } from "../../../components/loading";
import { CardThumb } from "../../../components/card-thumb";
import { apiUrl } from "../../../config/api";
import { isFeatureAllowed } from "../../../config/owners";
import { operationalRarezaLabel } from "../../../constants/item-rareza";
import { resolveStockImageUrl } from "../../../constants/bulk-product";
import { useOwner } from "../../../modules/owner";
import {
  isGoProWebcam,
  isPhoneWebcam,
  pickDefaultCameraDeviceId,
  readStoredCameraDeviceId,
  storeCameraDeviceId,
} from "./camera-capture-utils";
import { InventoryPhotoEditor } from "./inventory-photo-editor";
import {
  isInventoryPhotoSessionState,
  type InventoryPhotoSessionMode,
  type MissingPhotoRow,
} from "./inventory-photo-session";
import { useCameraCapture } from "./use-camera-capture";
import {
  fetchInventoryPhotoDataUrl,
  rewriteStockPhotoUrl,
} from "../../../utils/stock-photo-url";

export type { MissingPhotoRow };

export default function StockFotosInventarioPage() {
  const { owner } = useOwner();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const session = isInventoryPhotoSessionState(location.state)
    ? location.state
    : null;
  const [sessionMode, setSessionMode] = useState<InventoryPhotoSessionMode | null>(
    session?.mode ?? null,
  );
  const allowed = isFeatureAllowed(owner, "stock-inventario-fotos");

  const { data, isLoading, error } = useQuery({
    queryKey: ["stock-missing-photos", owner],
    enabled: allowed && !session,
    queryFn: async () => {
      const res = await axios.get<MissingPhotoRow[]>(
        apiUrl("/stock/inventory-photos/missing"),
      );
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const [completedStockIds, setCompletedStockIds] = useState<Set<string>>(
    () => new Set(),
  );

  const queue = useMemo(
    () => (data ?? []).filter((row) => !completedStockIds.has(row._id)),
    [completedStockIds, data],
  );

  const [index, setIndex] = useState(0);
  const isSingleSession = Boolean(session && sessionMode);
  const current = isSingleSession ? session!.row : (queue[index] ?? null);

  useEffect(() => {
    if (queue.length === 0) return;
    setIndex((prev) => Math.min(prev, queue.length - 1));
  }, [queue.length]);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [loadingExistingPhoto, setLoadingExistingPhoto] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{
    severity: "success" | "error";
    message: string;
  } | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() =>
    readStoredCameraDeviceId(),
  );
  const [sharpenCapture, setSharpenCapture] = useState(true);

  const cameraEnabled =
    allowed &&
    Boolean(current) &&
    !previewDataUrl &&
    (!isSingleSession || sessionMode === "retake");
  const {
    videoRef,
    status,
    errorMessage,
    focusPoint,
    devices,
    activeDeviceLabel,
    supportsTapFocus,
    fixedFocusWebcam,
    zoom,
    zoomRange,
    start,
    refocus,
    setZoom,
    focusAtClientPoint,
    capturePhoto,
    refreshDevices,
  } = useCameraCapture({
    enabled: cameraEnabled,
    deviceId: selectedDeviceId,
    sharpenCapture,
  });

  useEffect(() => {
    if (!session || sessionMode !== "edit" || previewDataUrl) return;
    const photoPath = session.photoPath?.trim();
    if (!photoPath) return;

    setLoadingExistingPhoto(true);
    void fetchInventoryPhotoDataUrl(rewriteStockPhotoUrl(photoPath))
      .then((dataUrl) => {
        if (dataUrl) setPreviewDataUrl(dataUrl);
        else {
          setSaveFeedback({
            severity: "error",
            message: "No se pudo cargar la foto para editar.",
          });
        }
      })
      .finally(() => setLoadingExistingPhoto(false));
  }, [previewDataUrl, session, sessionMode]);

  useEffect(() => {
    if (!allowed) return;
    void refreshDevices().then((list) => {
      if (selectedDeviceId) return;
      const next = pickDefaultCameraDeviceId(list, readStoredCameraDeviceId());
      if (next) setSelectedDeviceId(next);
    });
  }, [allowed, refreshDevices, selectedDeviceId]);

  const activeLabel =
    devices.find((d) => d.deviceId === selectedDeviceId)?.label ??
    activeDeviceLabel;

  const showGoProHint =
    !isPhoneWebcam(activeLabel) &&
    (fixedFocusWebcam ||
      isGoProWebcam(activeLabel) ||
      devices.some(
        (d) => d.deviceId === selectedDeviceId && isGoProWebcam(d.label),
      ));

  const showPhoneHint =
    isPhoneWebcam(activeLabel) ||
    devices.some(
      (d) => d.deviceId === selectedDeviceId && isPhoneWebcam(d.label),
    );

  const saveMutation = useMutation({
    mutationFn: async (payload: {
      stockId: string;
      imageBase64: string;
      cardName: string;
    }) => {
      const res = await axios.post<{ inventory_photo_url: string }>(
        apiUrl(`/stock/${payload.stockId}/inventory-photo`),
        { imageBase64: payload.imageBase64 },
      );
      return res.data;
    },
    onSuccess: (result, variables) => {
      setPreviewDataUrl(null);

      if (isSingleSession) {
        setSaveFeedback({
          severity: "success",
          message: `«${variables.cardName}» actualizada.`,
        });
        queryClient.setQueryData<Record<string, string>>(
          ["stock-inventory-photos-index", owner],
          (old) => ({
            ...(old ?? {}),
            [variables.stockId]: result.inventory_photo_url,
          }),
        );
        void queryClient.invalidateQueries({ queryKey: ["stock"] });
        void queryClient.invalidateQueries({
          queryKey: ["stock-inventory-photos-index", owner],
        });
        navigate("/stock", { replace: true });
        return;
      }

      setCompletedStockIds((prev) => {
        const next = new Set(prev);
        next.add(variables.stockId);
        return next;
      });

      setSaveFeedback({
        severity: "success",
        message: `«${variables.cardName}» guardada en local. Siguiente carta…`,
      });

      queryClient.setQueryData<MissingPhotoRow[]>(
        ["stock-missing-photos", owner],
        (old) => old?.filter((row) => row._id !== variables.stockId) ?? [],
      );

      queryClient.setQueryData<Record<string, string>>(
        ["stock-inventory-photos-index", owner],
        (old) => ({
          ...(old ?? {}),
          [variables.stockId]: result.inventory_photo_url,
        }),
      );

      void queryClient.invalidateQueries({ queryKey: ["stock"] });
      void queryClient.invalidateQueries({
        queryKey: ["stock-inventory-photos-index", owner],
      });
      void queryClient.invalidateQueries({
        queryKey: ["stock-missing-photos", owner],
        refetchType: "none",
      });
    },
    onError: (err) => {
      const msg =
        axios.isAxiosError(err) && err.response?.data
          ? String(
              (err.response.data as { message?: string }).message ??
                "Error al guardar",
            )
          : "No se pudo guardar la foto. Intenta de nuevo.";
      setSaveFeedback({ severity: "error", message: msg });
    },
  });

  const progress = useMemo(() => {
    if (queue.length === 0) return 100;
    return Math.round((index / queue.length) * 100);
  }, [index, queue.length]);

  if (!allowed) {
    return <Navigate to="/stock" replace />;
  }

  if (!session && isLoading) {
    return <LoadingScreen message="Buscando cartas sin foto…" />;
  }

  if (!session && error) {
    return (
      <Alert severity="error">
        No se pudo cargar la lista de cartas sin foto.
      </Alert>
    );
  }

  const handleTakePhoto = async () => {
    const shot = await capturePhoto();
    if (!shot) {
      setSaveFeedback({
        severity: "error",
        message: "No se pudo capturar la imagen. Intenta de nuevo.",
      });
      return;
    }
    setPreviewDataUrl(shot);
    setSaveFeedback(null);
  };

  const handleSkip = () => {
    setPreviewDataUrl(null);
    setSaveFeedback(null);
    setIndex((prev) => Math.min(prev + 1, Math.max(queue.length - 1, 0)));
  };

  if (!isSingleSession && queue.length === 0) {
    return (
      <Stack spacing={2}>
        <Typography variant="h5" fontWeight={700}>
          Fotos de inventario
        </Typography>
        <Alert severity="success">
          Todas las cartas disponibles tienen foto de inventario.
        </Alert>
        <Button variant="outlined" component={Link} to="/stock">
          Volver al stock
        </Button>
      </Stack>
    );
  }

  const referenceImage = current
    ? resolveStockImageUrl(current.card_id, current.image_url)
    : "";

  const pageTitle = isSingleSession
    ? sessionMode === "edit"
      ? "Editar foto de inventario"
      : "Volver a tomar foto"
    : "Fotos de inventario";

  if (loadingExistingPhoto) {
    return <LoadingScreen message="Cargando foto para editar…" />;
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 720, mx: "auto" }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          {pageTitle}
        </Typography>
        {!isSingleSession ? (
          <>
            <Typography variant="body2" color="text.secondary">
              Carta {index + 1} de {queue.length} sin foto
            </Typography>
            <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            {current?.card_name}
          </Typography>
        )}
      </Box>

      {saveFeedback ? (
        <Alert
          severity={saveFeedback.severity}
          onClose={() => setSaveFeedback(null)}
        >
          {saveFeedback.message}
        </Alert>
      ) : null}

      {isSingleSession ? (
        <Alert severity="info">
          {sessionMode === "edit"
            ? "Ajusta recorte, brillo y contraste. Al guardar vuelves al stock."
            : "Toma una foto nueva. Al guardar reemplaza la anterior."}
        </Alert>
      ) : null}

      {devices.length > 0 && (!isSingleSession || sessionMode === "retake") ? (
        <FormControl size="small" fullWidth>
          <InputLabel id="camera-device-label">Cámara</InputLabel>
          <Select
            labelId="camera-device-label"
            label="Cámara"
            value={
              devices.some((d) => d.deviceId === selectedDeviceId)
                ? selectedDeviceId
                : devices[0]?.deviceId ?? ""
            }
            onChange={(e) => {
              const next = String(e.target.value);
              setSelectedDeviceId(next);
              storeCameraDeviceId(next);
            }}
          >
            {devices.map((d) => (
              <MenuItem key={d.deviceId} value={d.deviceId}>
                {d.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}

      {showPhoneHint ? (
        <Alert severity="success">
          <strong>Celular como webcam (recomendado):</strong> instala{" "}
          <strong>DroidCam</strong> o <strong>Iriun</strong> (Android/iPhone) y
          conéctalo por USB o Wi‑Fi. Elige esa cámara arriba, apoya el celular
          mirando hacia abajo (~25 cm), toca la carta en pantalla para enfocar y
          usa zoom si hace falta. Tras tomar la foto podrás recortar y ajustar
          antes de guardar.
        </Alert>
      ) : null}

      {showGoProHint ? (
        <Alert severity="info">
          GoPro / webcam externa: enfoque fijo por hardware. Coloca la cámara a{" "}
          <strong>30–45 cm</strong> de la carta (no muy cerca). Si sigue borrosa,
          aléjala un poco más y usa el zoom digital abajo.
        </Alert>
      ) : null}

      {!showPhoneHint && !showGoProHint && !previewDataUrl ? (
        <Alert severity="info">
          Para mejores fotos usa el <strong>celular como webcam</strong> (DroidCam
          / Iriun): más nitidez y autofoco. Después de capturar puedes{" "}
          <strong>recortar, zoom, brillo y contraste</strong> antes de guardar.
        </Alert>
      ) : null}

      {current ? (
        <Card variant="outlined" key={current._id}>
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="h6">{current.card_name}</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={current.card_id} />
                {current.language ? (
                  <Chip size="small" label={current.language.toUpperCase()} />
                ) : null}
                {current.rareza ? (
                  <Chip
                    size="small"
                    label={operationalRarezaLabel(String(current.rareza).toLowerCase())}
                  />
                ) : null}
                <Chip size="small" label={current.card_state.replace(/_/g, " ")} />
              </Stack>
              {referenceImage ? (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Referencia TCGdex (si existe)
                  </Typography>
                  <CardThumb src={referenceImage} alt={current.card_name} size="lg" />
                </Box>
              ) : null}
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {previewDataUrl ? (
        <InventoryPhotoEditor
          imageDataUrl={previewDataUrl}
          saving={saveMutation.isPending}
          onRetake={() => {
            setPreviewDataUrl(null);
            if (isSingleSession) setSessionMode("retake");
          }}
          onApply={(edited) => {
            if (!current) return;
            saveMutation.mutate({
              stockId: current._id,
              cardName: current.card_name,
              imageBase64: edited,
            });
          }}
        />
      ) : (
        <Box
          sx={{
            position: "relative",
            width: "100%",
            aspectRatio: "4 / 3",
            bgcolor: "grey.900",
            borderRadius: 2,
            overflow: "hidden",
            cursor: !supportsTapFocus ? "default" : "crosshair",
          }}
          onClick={(e) => {
            if (status !== "ready") return;
            void focusAtClientPoint(e.clientX, e.clientY);
          }}
        >
          <Box
            component="video"
            ref={videoRef}
            autoPlay
            playsInline
            muted
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          {focusPoint ? (
            <Box
              sx={{
                position: "absolute",
                left: `${focusPoint.x * 100}%`,
                top: `${focusPoint.y * 100}%`,
                width: 56,
                height: 56,
                transform: "translate(-50%, -50%)",
                border: "2px solid #4ade80",
                borderRadius: "50%",
                pointerEvents: "none",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.08)",
              }}
            />
          ) : null}
        </Box>
      )}

      {!previewDataUrl && zoomRange ? (
        <Box sx={{ px: 0.5 }}>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Zoom digital ({zoom.toFixed(2)})
          </Typography>
          <Slider
            size="small"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step}
            value={zoom}
            onChange={(_, value) => void setZoom(value as number)}
          />
        </Box>
      ) : null}

      {!previewDataUrl ? (
        <Typography variant="caption" color="text.secondary">
          {fixedFocusWebcam
            ? "Nitidez+ activa al capturar. Ajusta distancia y zoom antes de tomar la foto."
            : supportsTapFocus
              ? "Toca la carta en pantalla para enfocar."
              : "Usa «Enfocar» si la cámara lo soporta."}
        </Typography>
      ) : null}

      {status === "error" && errorMessage ? (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => void start()}>
              Reintentar
            </Button>
          }
        >
          {errorMessage}
        </Alert>
      ) : null}

      {!previewDataUrl ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            onClick={() => void refocus()}
            disabled={
              status !== "ready" ||
              saveMutation.isPending ||
              fixedFocusWebcam
            }
            title={
              fixedFocusWebcam
                ? "GoPro/webcam: enfoque fijo; ajusta distancia"
                : undefined
            }
          >
            Enfocar
          </Button>
          <Button
            variant={sharpenCapture ? "contained" : "outlined"}
            color="secondary"
            onClick={() => setSharpenCapture((v) => !v)}
            disabled={status !== "ready" || saveMutation.isPending}
          >
            Nitidez+ {sharpenCapture ? "ON" : "OFF"}
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleTakePhoto()}
            disabled={status !== "ready" || saveMutation.isPending}
          >
            Tomar foto
          </Button>
          <Button variant="outlined" onClick={handleSkip}>
            Saltar
          </Button>
          <Button variant="text" component={Link} to="/stock">
            Volver al stock
          </Button>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {isSingleSession && sessionMode === "edit" ? (
            <Button
              variant="outlined"
              onClick={() => {
                setPreviewDataUrl(null);
                setSessionMode("retake");
              }}
            >
              Volver a tomar
            </Button>
          ) : null}
          <Button variant="text" component={Link} to="/stock">
            Volver al stock
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
