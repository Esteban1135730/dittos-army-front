import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Link,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { PageContainer } from "../../components/layout/page-container";

type HubCard = {
  title: string;
  description: string;
  to: string;
};

/** Camino principal: de alta → precio → cobro */
const FLOW_STEPS: Array<{
  step: number;
  title: string;
  description: string;
  to: string;
  cta: string;
}> = [
  {
    step: 1,
    title: "Agregar cartas al inventario",
    description:
      "Es la pantalla donde registras cartas nuevas con su coste. Todo lo que quieras vender debe pasar primero por aquí.",
    to: "/add-stock",
    cta: "Ir a agregar cartas",
  },
  {
    step: 2,
    title: "Poner precio de venta (PVP)",
    description:
      "En el inventario ves tus cartas y abres cada una para asignar el precio al público antes de cobrar.",
    to: "/stock",
    cta: "Ir al inventario",
  },
  {
    step: 3,
    title: "Cobrar en el mostrador",
    description:
      "Cuando el cliente compra, registras la venta aquí para descontar stock y llevar el ciclo de ventas.",
    to: "/ventas",
    cta: "Ir al mostrador",
  },
];

/** Alta y orientación */
const CARTAS_AGREGAR: HubCard[] = [
  {
    title: "Agregar cartas al inventario",
    description:
      "Único lugar para dar de alta cartas nuevas con coste. Sin este paso no hay venta.",
    to: "/add-stock",
  },
  {
    title: "¿Por dónde empiezo?",
    description:
      "Guía si no sabes si cotizar, agregar stock o ir al inventario.",
    to: "/cotizar",
  },
];

/** Todo lo que ya está cargado: lista, precio, edición, casos especiales */
const CARTAS_GESTIONAR: HubCard[] = [
  {
    title: "Inventario",
    description:
      "Lista completa: aquí pones PVP (paso 2), editas filas, exportas PDF y gestionas cada carta.",
    to: "/stock",
  },
  {
    title: "Apertura de sellado",
    description:
      "Cuando abres producto cerrado y repartes el costo entre varias cartas.",
    to: "/stock/apertura-sellado",
  },
];

const SECTIONS_RESTO: { label: string; items: HubCard[] }[] = [
  {
    label: "Compras a proveedores",
    items: [
      {
        title: "Compras en camino",
        description: "Lotes, rondas y recepción de mercancía.",
        to: "/incoming",
      },
      {
        title: "Nueva compra",
        description: "Registrar un lote entrante.",
        to: "/incoming/new",
      },
    ],
  },
  {
    label: "Ventas — seguimiento",
    items: [
      {
        title: "Consistencia",
        description: "Comparar stock vs ventas registradas.",
        to: "/ventas/consistencia",
      },
      {
        title: "Histórico",
        description: "Ventas cerradas y reaperturas.",
        to: "/ventas/historico",
      },
      {
        title: "Cartas en propiedad",
        description: "Seguimiento de cartas reservadas o en ciclo.",
        to: "/propiedad",
      },
    ],
  },
  {
    label: "Clientes",
    items: [
      {
        title: "Directorio",
        description: "Clientes, contacto y reservas.",
        to: "/clientes",
      },
      {
        title: "Imprimir pedidos",
        description: "Etiquetas y listados para preparación.",
        to: "/clientes/imprimir-pedidos",
      },
    ],
  },
  {
    label: "Facturación",
    items: [
      {
        title: "Facturación electrónica",
        description: "Factus y envío de documentos.",
        to: "/facturacion-electronica",
      },
    ],
  },
];

function SectionCards({
  label,
  items,
}: {
  label: string;
  items: HubCard[];
}) {
  return (
    <Box>
      <Typography
        variant="overline"
        color="primary"
        sx={{
          letterSpacing: "0.08em",
          fontWeight: 700,
          display: "block",
          mb: 1.5,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(3, minmax(0, 1fr))",
          },
        }}
      >
        {items.map((item) => (
          <Card key={item.to} variant="outlined" sx={{ height: "100%" }}>
            <CardActionArea
              component={RouterLink}
              to={item.to}
              sx={{ height: "100%", alignItems: "stretch" }}
            >
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  {item.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.description}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}

export default function Home() {
  return (
    <PageContainer>
      <Typography
        variant="h4"
        component="h1"
        gutterBottom
        sx={{ mb: 0.5, fontSize: { xs: "1.5rem", sm: "1.75rem" } }}
      >
        Inicio
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3, maxWidth: 820 }}>
        <strong>Cartas — agregar</strong> es solo alta nueva;{" "}
        <strong>Cartas — gestionar</strong> es todo lo demás (lista, PVP, editar).
        El menú lateral y los tres pasos de abajo cuentan la misma historia para{" "}
        <strong>vender</strong>. También puedes abrir el{" "}
        <Link component={RouterLink} to="/cartas" underline="hover" fontWeight={600}>
          centro de cartas
        </Link>{" "}
        si prefieres los mismos accesos en una sola vista.
      </Typography>

      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="subtitle2" gutterBottom>
          Resumen rápido
        </Typography>
        Las cartas <strong>no aparecen solas</strong> en el mostrador: primero las
        das de alta con coste (paso 1), luego les pones precio en{" "}
        <strong>Inventario</strong> (paso 2), y por último cobras en{" "}
        <strong>Mostrador</strong> (paso 3).
      </Alert>

      <Typography
        variant="overline"
        color="primary"
        sx={{
          letterSpacing: "0.08em",
          fontWeight: 700,
          display: "block",
          mb: 2,
        }}
      >
        Vender en tienda — pasos 1 a 3
      </Typography>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 5 }}
      >
        {FLOW_STEPS.map((s) => (
          <Paper
            key={s.step}
            elevation={0}
            sx={{
              flex: 1,
              p: 2.5,
              border: "2px solid",
              borderColor: "primary.light",
              bgcolor: "background.paper",
              display: "flex",
              flexDirection: "column",
              gap: 1.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                fontWeight: 800,
                color: "primary.main",
                letterSpacing: "0.12em",
              }}
            >
              PASO {s.step}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {s.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {s.description}
            </Typography>
            <Button
              component={RouterLink}
              to={s.to}
              variant={s.step === 1 ? "contained" : "outlined"}
              fullWidth
              size="medium"
            >
              {s.cta}
            </Button>
          </Paper>
        ))}
      </Stack>

      <Stack spacing={4} sx={{ mb: 4 }}>
        <SectionCards label="Cartas — agregar" items={CARTAS_AGREGAR} />
        <SectionCards label="Cartas — gestionar" items={CARTAS_GESTIONAR} />
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Compras, seguimiento de ventas, clientes y facturación:
      </Typography>

      <Stack spacing={4}>
        {SECTIONS_RESTO.map((section) => (
          <SectionCards key={section.label} label={section.label} items={section.items} />
        ))}
      </Stack>
    </PageContainer>
  );
}
