import {
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { PageContainer } from "../../components/layout/page-container";

/**
 * La ruta /cotizar estaba vacía; orientamos al usuario hacia flujos reales de inventario y precios.
 */
export default function CotizarPlaceholderPage() {
  return (
    <PageContainer maxWidth={640}>
      <Typography variant="h5" gutterBottom>
        ¿Dónde agregar cartas para vender?
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        El lugar correcto es <strong>Agregar cartas al inventario</strong> (paso 1).
        Luego pones el precio en <strong>Inventario</strong> (paso 2) y cobras en{" "}
        <strong>Ventas / mostrador</strong> (paso 3).
      </Typography>
      <Stack spacing={2}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Entrada de inventario
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Alta de cartas nuevas (costes, envío, rareza).
            </Typography>
            <Button component={RouterLink} to="/add-stock" variant="contained">
              Ir a agregar stock
            </Button>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Ver inventario y asignar PVP
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Lista de stock; desde cada carta puedes abrir precios de venta.
            </Typography>
            <Button component={RouterLink} to="/stock" variant="outlined">
              Ir al stock
            </Button>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
}
