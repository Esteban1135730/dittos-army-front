import type { ReactNode } from "react";
import { Fragment } from "react";
import { NavLink } from "react-router-dom";
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
} from "@mui/material";
import EuroToCOPConverter from "../../utils/tasa";

const DRAWER_WIDTH = 288;

type NavEntry = {
  to: string;
  label: string;
  /** Texto pequeño que explica qué hace esta pantalla */
  secondary?: string;
  /** Solo coincide ruta exacta */
  end?: boolean;
};

type NavSection = {
  title: string;
  items: NavEntry[];
};

const SECTIONS: NavSection[] = [
  {
    title: "General",
    items: [
      { to: "/", label: "Inicio", end: true, secondary: "Mapa del sistema" },
      {
        to: "/cartas",
        label: "Centro de cartas",
        secondary: "Agregar vs gestionar en una pantalla.",
      },
    ],
  },
  {
    title: "Cartas — agregar",
    items: [
      {
        to: "/add-stock",
        label: "Agregar cartas al inventario",
        secondary: "Alta nueva con coste. Es el paso 1 si vas a vender.",
      },
      {
        to: "/cotizar",
        label: "¿Por dónde empiezo?",
        secondary: "Guía rápida: alta de cartas y flujo de venta.",
      },
    ],
  },
  {
    title: "Cartas — gestionar",
    items: [
      {
        to: "/stock",
        label: "Inventario",
        secondary:
          "Tabla de cartas: PVP, editar, exportar. Paso 2 del flujo de venta.",
      },
      {
        to: "/stock/apertura-sellado",
        label: "Apertura de producto sellado",
        secondary: "Repartir el costo de un sobre entre varias cartas.",
      },
    ],
  },
  {
    title: "Vender en tienda (1 → 2 → 3)",
    items: [
      {
        to: "/add-stock",
        label: "1 · Agregar cartas",
        secondary: "Entrada al inventario con coste.",
      },
      {
        to: "/stock",
        label: "2 · Precio de venta (PVP)",
        secondary: "En la tabla de inventario, por carta.",
      },
      {
        to: "/ventas",
        label: "3 · Mostrador — cobrar",
        secondary: "Registra la venta cuando el cliente paga.",
        end: true,
      },
    ],
  },
  {
    title: "Compras a proveedores",
    items: [
      {
        to: "/incoming",
        label: "Compras en camino",
        secondary: "Lotes y recepción.",
      },
      {
        to: "/incoming/new",
        label: "Nueva compra (lote)",
        secondary: "Registrar compra entrante.",
      },
    ],
  },
  {
    title: "Ventas — seguimiento",
    items: [
      {
        to: "/ventas/consistencia",
        label: "Consistencia stock vs ventas",
        secondary: "Detectar diferencias.",
      },
      {
        to: "/ventas/historico",
        label: "Histórico de ventas",
        secondary: "Ventas cerradas.",
      },
      {
        to: "/propiedad",
        label: "Cartas en propiedad",
        secondary: "Reservadas o en ciclo.",
      },
    ],
  },
  {
    title: "Clientes",
    items: [
      {
        to: "/clientes",
        label: "Directorio de clientes",
        end: true,
        secondary: "Datos y reservas.",
      },
      {
        to: "/clientes/imprimir-pedidos",
        label: "Imprimir pedidos",
        secondary: "Etiquetas y listados.",
      },
    ],
  },
  {
    title: "Facturación",
    items: [
      {
        to: "/facturacion-electronica",
        label: "Facturación electrónica",
        secondary: "Factus / documentos.",
      },
    ],
  },
];

function SidebarNav() {
  return (
    <List dense disablePadding sx={{ px: 1, pb: 2 }}>
      {SECTIONS.map((section) => (
        <Fragment key={section.title}>
          <ListSubheader
            sx={{
              bgcolor: "transparent",
              color: "grey.400",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              py: 1,
              whiteSpace: "normal",
              lineHeight: 1.35,
            }}
          >
            {section.title}
          </ListSubheader>
          {section.items.map((item) => (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              end={item.end ?? false}
              alignItems="flex-start"
              sx={{
                borderRadius: 1,
                mb: 0.5,
                py: 1,
                color: "grey.100",
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.08)",
                },
                "& .MuiListItemText-secondary": {
                  color: "grey.400",
                },
                "&.active": {
                  bgcolor: "primary.main",
                  color: "primary.contrastText",
                  "& .MuiListItemText-secondary": {
                    color: "rgba(255,255,255,0.85) !important",
                  },
                },
              }}
            >
              <ListItemText
                primary={item.label}
                secondary={item.secondary}
                primaryTypographyProps={{
                  variant: "body2",
                  sx: { fontWeight: 600, lineHeight: 1.35 },
                }}
                secondaryTypographyProps={{
                  variant: "caption",
                  sx: {
                    mt: 0.35,
                    lineHeight: 1.35,
                    opacity: 0.92,
                  },
                }}
              />
            </ListItemButton>
          ))}
        </Fragment>
      ))}
    </List>
  );
}

export default function SideLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: DRAWER_WIDTH,
            boxSizing: "border-box",
            bgcolor: "primary.dark",
            color: "grey.100",
            borderRight: "none",
          },
        }}
      >
        <Toolbar
          sx={{
            flexDirection: "column",
            alignItems: "flex-start",
            py: 2,
            gap: 0.5,
          }}
        >
          <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
            Ditto Army
          </Typography>
          <Typography variant="caption" sx={{ color: "grey.400", lineHeight: 1.45 }}>
            <strong>Agregar</strong> = alta nueva · <strong>Gestionar</strong> = inventario
            y PVP · <strong>1→2→3</strong> = atajo al flujo de venta completo.
          </Typography>
        </Toolbar>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
        <Box sx={{ overflow: "auto", flex: 1 }}>
          <SidebarNav />
        </Box>
        <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
        <Box sx={{ p: 2, pb: 3 }}>
          <EuroToCOPConverter />
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: "background.default",
          minHeight: "100vh",
          p: { xs: 2, sm: 3 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
