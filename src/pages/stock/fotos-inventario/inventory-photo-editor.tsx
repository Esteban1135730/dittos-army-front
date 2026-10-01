import {
  Box,
  Button,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CARD_ASPECT_RATIO,
  clampEditScale,
  compressInventoryPhotoDataUrl,
  computeCropFrameSize,
  computeImageLayout,
  DEFAULT_PHOTO_EDIT,
  renderEditedPhoto,
  type PhotoEditAdjustments,
} from "./photo-edit-utils";

type InventoryPhotoEditorProps = {
  imageDataUrl: string;
  onApply: (editedDataUrl: string) => void;
  onRetake: () => void;
  saving?: boolean;
};

export function InventoryPhotoEditor({
  imageDataUrl,
  onApply,
  onRetake,
  saving = false,
}: InventoryPhotoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [edit, setEdit] = useState<PhotoEditAdjustments>(DEFAULT_PHOTO_EDIT);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [processing, setProcessing] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });

  const updateFrameSize = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setFrameSize(computeCropFrameSize(rect.width, rect.height, CARD_ASPECT_RATIO));
  }, []);

  useEffect(() => {
    updateFrameSize();
    window.addEventListener("resize", updateFrameSize);
    return () => window.removeEventListener("resize", updateFrameSize);
  }, [updateFrameSize]);

  useEffect(() => {
    setNaturalSize({ width: 0, height: 0 });
    setEdit(DEFAULT_PHOTO_EDIT);
  }, [imageDataUrl]);

  const filterStyle = useMemo(
    () =>
      `brightness(${100 + edit.brightness}%) contrast(${100 + edit.contrast}%)`,
    [edit.brightness, edit.contrast],
  );

  const imageLayout = useMemo(() => {
    if (naturalSize.width <= 0 || frameSize.width <= 0) return null;
    return computeImageLayout(
      naturalSize.width,
      naturalSize.height,
      frameSize.width,
      frameSize.height,
      edit,
    );
  }, [edit, frameSize.height, frameSize.width, naturalSize.height, naturalSize.width]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (saving || processing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      ox: edit.offsetX,
      oy: edit.offsetY,
    };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setEdit((prev) => ({
      ...prev,
      offsetX: dragStart.current.ox + dx,
      offsetY: dragStart.current.oy + dy,
    }));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleApply = async () => {
    if (frameSize.width <= 0 || frameSize.height <= 0) return;
    setProcessing(true);
    try {
      const out = await renderEditedPhoto(
        imageDataUrl,
        frameSize.width,
        frameSize.height,
        edit,
      );
      const compressed = await compressInventoryPhotoDataUrl(out);
      onApply(compressed);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2" fontWeight={600}>
        Editar foto antes de guardar
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Solo se guarda lo que queda dentro del marco verde. Arrastra, haz zoom y
        ajusta brillo/contraste; luego pulsa «Aplicar y guardar».
      </Typography>

      <Box
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 3",
          bgcolor: "grey.900",
          borderRadius: 2,
          overflow: "hidden",
          touchAction: "none",
          cursor: dragging ? "grabbing" : "grab",
        }}
      >
        {frameSize.width > 0 ? (
          <>
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: frameSize.width,
                height: frameSize.height,
                transform: "translate(-50%, -50%)",
                overflow: "hidden",
                bgcolor: "grey.800",
              }}
            >
              <Box
                component="img"
                src={imageDataUrl}
                alt="Editar"
                draggable={false}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setNaturalSize({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                }}
                sx={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: naturalSize.width > 0 ? naturalSize.width : "auto",
                  height: naturalSize.height > 0 ? naturalSize.height : "auto",
                  maxWidth: "none",
                  maxHeight: "none",
                  filter: filterStyle,
                  transform: imageLayout
                    ? `translate(calc(-50% + ${imageLayout.offsetX}px), calc(-50% + ${imageLayout.offsetY}px)) rotate(${imageLayout.rotation}deg) scale(${imageLayout.scale})`
                    : "translate(-50%, -50%)",
                  transformOrigin: "center center",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
            </Box>
            <Box
              sx={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: frameSize.width,
                height: frameSize.height,
                transform: "translate(-50%, -50%)",
                border: "2px solid #4ade80",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                pointerEvents: "none",
              }}
            />
            <Typography
              variant="caption"
              sx={{
                position: "absolute",
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
                color: "common.white",
                bgcolor: "rgba(0,0,0,0.55)",
                px: 1,
                py: 0.25,
                borderRadius: 1,
                pointerEvents: "none",
              }}
            >
              Marco carta — arrastra para mover
            </Typography>
          </>
        ) : null}
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary">
          Zoom recorte ({edit.scale.toFixed(1)}×)
        </Typography>
        <Slider
          size="small"
          min={1}
          max={4}
          step={0.05}
          value={edit.scale}
          onChange={(_, v) =>
            setEdit((prev) => ({ ...prev, scale: clampEditScale(v as number) }))
          }
          disabled={saving || processing}
        />
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Brillo ({edit.brightness})
          </Typography>
          <Slider
            size="small"
            min={-40}
            max={40}
            value={edit.brightness}
            onChange={(_, v) =>
              setEdit((prev) => ({ ...prev, brightness: v as number }))
            }
            disabled={saving || processing}
          />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Contraste ({edit.contrast})
          </Typography>
          <Slider
            size="small"
            min={-40}
            max={40}
            value={edit.contrast}
            onChange={(_, v) =>
              setEdit((prev) => ({ ...prev, contrast: v as number }))
            }
            disabled={saving || processing}
          />
        </Box>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          variant="outlined"
          size="small"
          onClick={() =>
            setEdit((prev) => ({
              ...prev,
              rotation: ((prev.rotation + 90) % 360) as 0 | 90 | 180 | 270,
            }))
          }
          disabled={saving || processing}
        >
          Rotar 90°
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setEdit(DEFAULT_PHOTO_EDIT)}
          disabled={saving || processing}
        >
          Restablecer
        </Button>
        <Button
          variant={edit.sharpen > 0 ? "contained" : "outlined"}
          size="small"
          color="secondary"
          onClick={() =>
            setEdit((prev) => ({
              ...prev,
              sharpen: prev.sharpen > 0 ? 0 : 0.45,
            }))
          }
          disabled={saving || processing}
        >
          Nitidez+ {edit.sharpen > 0 ? "ON" : "OFF"}
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <Button
          variant="contained"
          color="success"
          onClick={() => void handleApply()}
          disabled={saving || processing}
        >
          {processing ? "Procesando…" : saving ? "Guardando…" : "Aplicar y guardar"}
        </Button>
        <Button variant="outlined" onClick={onRetake} disabled={saving || processing}>
          Repetir foto
        </Button>
      </Stack>
    </Stack>
  );
}
