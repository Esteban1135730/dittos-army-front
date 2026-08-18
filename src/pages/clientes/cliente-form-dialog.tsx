import { useEffect, useState } from "react";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import {
  API_CLIENT,
  emptyClienteForm,
  formFromClient,
  type ClienteFormState,
  type ClientItem,
} from "./cliente-types";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  /** Obligatorio si `mode === "edit"`. */
  client?: ClientItem | null;
  onClose: () => void;
  onSaved?: () => void;
};

export default function ClienteFormDialog({ open, mode, client, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClienteFormState>(emptyClienteForm);
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (mode === "edit" && client) {
      setForm(formFromClient(client));
    } else {
      setForm(emptyClienteForm());
    }
  }, [open, mode, client?._id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.nombre.trim()) {
      setErrorMsg("El nombre es obligatorio.");
      return;
    }
    if (form.metodoContacto === "facebook" && !form.facebookUsuario.trim()) {
      setErrorMsg("Usuario de Facebook obligatorio para canal Facebook.");
      return;
    }
    setGuardando(true);
    try {
      const body = {
        nombre: form.nombre.trim(),
        celular: form.celular.trim() || undefined,
        metodo_contacto: form.metodoContacto,
        facebook_usuario:
          form.metodoContacto === "facebook" ? form.facebookUsuario.trim() : undefined,
        notas: form.notas.trim() || undefined,
      };
      if (mode === "edit" && client) {
        await axios.put(`${API_CLIENT}/${client._id}`, body);
        await queryClient.invalidateQueries({ queryKey: ["clientes"] });
        await queryClient.invalidateQueries({ queryKey: ["client", client._id] });
      } else {
        await axios.post(API_CLIENT, body);
        await queryClient.invalidateQueries({ queryKey: ["clientes"] });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && typeof err.response?.data?.message === "string"
          ? err.response.data.message
          : "No se pudo guardar.";
      setErrorMsg(msg);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={guardando ? undefined : onClose}
      maxWidth="md"
      fullWidth
      scroll="body"
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ pb: 1 }}>
          {mode === "edit" ? "Editar cliente" : "Nuevo cliente"}
        </DialogTitle>
        <DialogContent dividers sx={{ pt: 2 }}>
          {errorMsg ? (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg(null)}>
              {errorMsg}
            </Alert>
          ) : null}
          <Stack spacing={3}>
            <TextField
              label="Nombre"
              required
              fullWidth
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="WhatsApp (número o @nick)"
                fullWidth
                value={form.celular}
                onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))}
                helperText="Número (p. ej. 3001234567) o usuario @{nick}"
              />
              <TextField
                select
                label="Canal preferido"
                fullWidth
                value={form.metodoContacto}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    metodoContacto: e.target.value as "whatsapp" | "facebook",
                  }))
                }
                SelectProps={{ native: true }}
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="facebook">Facebook / Messenger</option>
              </TextField>
            </Stack>
            {form.metodoContacto === "facebook" && (
              <TextField
                label="Usuario de Facebook"
                required
                fullWidth
                value={form.facebookUsuario}
                onChange={(e) => setForm((f) => ({ ...f, facebookUsuario: e.target.value }))}
                helperText="Sin @ ni URL"
              />
            )}
            <TextField
              label="Notas internas"
              fullWidth
              multiline
              minRows={4}
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              helperText="Solo panel; no se envía al cliente automáticamente."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={onClose} disabled={guardando} color="inherit">
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={guardando}>
            {guardando ? "Guardando…" : mode === "edit" ? "Guardar" : "Crear"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
