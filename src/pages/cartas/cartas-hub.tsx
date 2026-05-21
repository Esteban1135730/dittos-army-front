import {
  Button,
  Card,
  CardContent,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { PageContainer } from "../../components/layout/page-container";

/**
 * Hub opcional: mismo mapa mental que Inicio y el drawer, en una sola pantalla para formación.
 */
export default function CartasHubPage() {
  return (
    <PageContainer maxWidth={720}>
      <Typography variant="h4" component="h1" gutterBottom>
        Centro de cartas
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Elige si vas a <strong>dar de alta</strong> cartas nuevas o a{" "}
        <strong>trabajar con lo que ya está</strong> en el inventario (precio, edición,
        apertura de sellado).
      </Typography>

      <Stack spacing={2} sx={{ mb: 4 }}>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
              Agregar cartas
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Alta con coste: es el paso 1 del flujo de venta en tienda.
            </Typography>
            <Button component={RouterLink} to="/add-stock" variant="contained" fullWidth>
              Ir a agregar cartas al inventario
            </Button>
          </CardContent>
        </Card>
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 700 }}>
              Gestionar inventario
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Lista, PVP (paso 2), editar cartas y casos como apertura de sellado.
            </Typography>
            <Stack spacing={1}>
              <Button component={RouterLink} to="/stock" variant="outlined" fullWidth>
                Ir al inventario
              </Button>
              <Button
                component={RouterLink}
                to="/stock/apertura-sellado"
                variant="text"
                fullWidth
              >
                Apertura de producto sellado
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Paper
        elevation={0}
        sx={{
          p: 2.5,
          border: "2px solid",
          borderColor: "primary.light",
          bgcolor: "background.paper",
        }}
      >
        <Typography
          variant="caption"
          sx={{ fontWeight: 800, color: "primary.main", letterSpacing: "0.12em" }}
          display="block"
          gutterBottom
        >
          Vender en tienda — orden recomendado
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          1 · Agregar cartas → 2 · PVP en inventario → 3 · Cobrar en mostrador.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button component={RouterLink} to="/add-stock" size="small" variant="outlined">
            Paso 1
          </Button>
          <Button component={RouterLink} to="/stock" size="small" variant="outlined">
            Paso 2
          </Button>
          <Button component={RouterLink} to="/ventas" size="small" variant="contained">
            Paso 3 — Mostrador
          </Button>
        </Stack>
      </Paper>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        ¿Primera vez?{" "}
        <RouterLink to="/cotizar" style={{ fontWeight: 600 }}>
          ¿Por dónde empiezo?
        </RouterLink>{" "}
        ·{" "}
        <RouterLink to="/" style={{ fontWeight: 600 }}>
          Volver al inicio
        </RouterLink>
      </Typography>
    </PageContainer>
  );
}
