import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import lockupUrl from "./el-nido-tcg-lockup.png";
import {
  downloadGruposPdf,
  filterGruposPdfImageFiles,
  GRUPOS_PDF_ACCEPT_ATTR,
  GRUPOS_PDF_MANY_IMAGES_WARN,
  GRUPOS_PDF_WEB_URL,
  readBlobAsDataUrl,
} from "./pdf-grupos";

type PreviewItem = {
  id: string;
  file: File;
  previewUrl: string;
};

type Notice = { severity: "error" | "warning" | "info"; message: string };

let logoDataUrlPromise: Promise<string> | null = null;

function loadLogoDataUrl(): Promise<string> {
  if (!logoDataUrlPromise) {
    logoDataUrlPromise = (async () => {
      const res = await fetch(lockupUrl);
      if (!res.ok) {
        throw new Error("No se pudo cargar el logo.");
      }
      return readBlobAsDataUrl(await res.blob());
    })().catch((err: unknown) => {
      logoDataUrlPromise = null;
      throw err;
    });
  }
  return logoDataUrlPromise;
}

function newItemId(): string {
  return crypto.randomUUID();
}

function filesFromList(list: FileList | File[]): File[] {
  return Array.from(list);
}

export default function PdfGruposPage() {
  const itemsRef = useRef<PreviewItem[]>([]);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  itemsRef.current = items;

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, []);

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const { accepted, rejected } = filterGruposPdfImageFiles(incoming);
    if (rejected.length > 0) {
      setNotice({
        severity: "warning",
        message: "Solo se aceptan JPG, PNG o WEBP",
      });
    } else {
      setNotice(null);
    }
    if (accepted.length === 0) return;

    const nextItems = accepted.map((file) => ({
      id: newItemId(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    const nextCount = items.length + nextItems.length;
    if (rejected.length === 0 && nextCount > GRUPOS_PDF_MANY_IMAGES_WARN) {
      setNotice({
        severity: "warning",
        message:
          "Hay más de 40 imágenes; el PDF puede tardar o pesar más de lo habitual.",
      });
    }
    setItems((prev) => [...prev, ...nextItems]);
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const list = event.target.files;
    if (list) addFiles(filesFromList(list));
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    addFiles(filesFromList(event.dataTransfer.files));
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const found = prev.find((item) => item.id === id);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return prev.filter((item) => item.id !== id);
    });
  };

  const onGenerate = async () => {
    if (items.length === 0 || generating) return;
    setGenerating(true);
    setNotice(null);
    try {
      const logoDataUrl = await loadLogoDataUrl();
      const result = await downloadGruposPdf({
        files: items.map((item) => item.file),
        logoDataUrl,
      });
      if (result.skippedUnreadable > 0) {
        setNotice({
          severity: "warning",
          message: "Algunas imágenes no se pudieron leer y se omitieron.",
        });
      }
    } catch (err) {
      setNotice({
        severity: "error",
        message:
          err instanceof Error && err.message.trim()
            ? err.message
            : "No se pudo generar el PDF.",
      });
    } finally {
      setGenerating(false);
    }
  };

  const empty = items.length === 0;

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", py: { xs: 2, md: 3 }, px: { xs: 0.5, md: 0 } }}>
      <Stack spacing={2.5}>
        <Stack spacing={1.5} alignItems="flex-start">
          <Box
            component="a"
            href={GRUPOS_PDF_WEB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir elnidotcg.store"
            sx={{
              display: "inline-flex",
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: "#f3ebe1",
              border: "1px solid",
              borderColor: "divider",
              lineHeight: 0,
            }}
          >
            <Box
              component="img"
              src={lockupUrl}
              alt="El Nido TCG"
              sx={{ width: 148, height: 148, objectFit: "contain", display: "block" }}
            />
          </Box>
          <Stack spacing={0.5}>
            <Typography variant="h4" fontWeight={900} letterSpacing={-0.6}>
              Generar PDF para grupos
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Carga fotos, una página por imagen, con el logo de El Nido TCG arriba y
              fecha, Instagram y WhatsApp abajo. El logo abre la tienda. El archivo no
              se sube al servidor.
            </Typography>
          </Stack>
        </Stack>

        {notice ? (
          <Alert
            severity={notice.severity}
            onClose={() => setNotice(null)}
            sx={{ borderRadius: 2 }}
          >
            {notice.message}
          </Alert>
        ) : null}

        <Box
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          sx={{
            border: "1px dashed",
            borderColor: dragging ? "primary.main" : "divider",
            bgcolor: dragging ? "action.hover" : "background.paper",
            borderRadius: 2,
            p: 2.5,
          }}
        >
          <Stack spacing={1.5} alignItems="flex-start">
            <Typography variant="body2" color="text.secondary">
              Arrastra imágenes aquí o elige archivos (JPG, PNG o WEBP).
            </Typography>
            <Button variant="outlined" component="label" disabled={generating}>
              Cargar imágenes
              <input
                type="file"
                hidden
                accept={GRUPOS_PDF_ACCEPT_ATTR}
                multiple
                onChange={onPick}
              />
            </Button>
          </Stack>
        </Box>

        {empty ? (
          <Typography variant="body2" color="text.secondary">
            Carga al menos una imagen
          </Typography>
        ) : (
          <Stack spacing={1}>
            {items.map((item) => (
              <Stack
                key={item.id}
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{
                  p: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "background.paper",
                }}
              >
                <Box
                  component="img"
                  src={item.previewUrl}
                  alt=""
                  sx={{
                    width: 48,
                    height: 48,
                    objectFit: "contain",
                    bgcolor: "#f3ebe1",
                    borderRadius: 1,
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {item.file.name}
                </Typography>
                <Button
                  size="small"
                  onClick={() => removeItem(item.id)}
                  disabled={generating}
                >
                  Quitar
                </Button>
              </Stack>
            ))}
          </Stack>
        )}

        {generating ? <LinearProgress sx={{ borderRadius: 1 }} /> : null}

        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            variant="contained"
            onClick={() => void onGenerate()}
            disabled={empty || generating}
            sx={{ borderRadius: 2 }}
          >
            {generating ? "Generando PDF…" : "Generar PDF"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
