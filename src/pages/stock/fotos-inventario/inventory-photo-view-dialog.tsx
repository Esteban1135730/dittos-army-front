import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { rewriteStockPhotoUrl } from "../../../utils/stock-photo-url";
import { CARD_ASPECT_RATIO } from "./photo-edit-utils";

type InventoryPhotoViewDialogProps = {
  open: boolean;
  cardName: string;
  photoPath: string | null;
  onClose: () => void;
  onEditPhoto?: () => void;
  onRetakePhoto?: () => void;
};

export function InventoryPhotoViewDialog({
  open,
  cardName,
  photoPath,
  onClose,
  onEditPhoto,
  onRetakePhoto,
}: InventoryPhotoViewDialogProps) {
  const src = photoPath ? rewriteStockPhotoUrl(photoPath) : "";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        Foto de inventario
        <Typography variant="body2" color="text.secondary">
          {cardName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {src ? (
          <Box
            sx={{
              width: "100%",
              maxWidth: 320,
              mx: "auto",
              aspectRatio: `${CARD_ASPECT_RATIO}`,
              borderRadius: 2,
              overflow: "hidden",
              bgcolor: "#f3ebe1",
              boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
            }}
          >
            <Box
              component="img"
              src={src}
              alt={cardName}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </Box>
        ) : (
          <Typography color="text.secondary">Sin foto de inventario.</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ width: "100%", p: 1 }}
          justifyContent="flex-end"
        >
          {onEditPhoto ? (
            <Button variant="contained" onClick={onEditPhoto}>
              Editar foto
            </Button>
          ) : null}
          {onRetakePhoto ? (
            <Button variant="outlined" onClick={onRetakePhoto}>
              Volver a tomar
            </Button>
          ) : null}
          <Button onClick={onClose}>Cerrar</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
