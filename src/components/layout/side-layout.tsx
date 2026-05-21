import type { ReactNode } from "react";
import { Fragment, useCallback, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import EuroToCOPConverter from "../../utils/tasa";

const DRAWER_WIDTH = 288;

type NavEntry = {
  to: string;
  label: string;
  secondary?: string;
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

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
    </svg>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
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
              key={`${section.title}-${item.to}-${item.label}`}
              component={NavLink}
              to={item.to}
              end={item.end ?? false}
              alignItems="flex-start"
              onClick={onNavigate}
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
                slotProps={{
                  primary: {
                    variant: "body2",
                    sx: { fontWeight: 600, lineHeight: 1.35 },
                  },
                  secondary: {
                    variant: "caption",
                    sx: {
                      mt: 0.35,
                      lineHeight: 1.35,
                      opacity: 0.92,
                    },
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

function DrawerPanel({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <Toolbar
        sx={{
          flexDirection: "column",
          alignItems: "flex-start",
          py: 2,
          gap: 0.5,
          minHeight: { xs: 64, md: 72 },
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
        <SidebarNav onNavigate={onNavigate} />
      </Box>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
      <Box sx={{ p: 2, pb: 3 }}>
        <EuroToCOPConverter compact />
      </Box>
    </>
  );
}

const drawerPaperSx = {
  width: DRAWER_WIDTH,
  boxSizing: "border-box" as const,
  bgcolor: "primary.dark",
  color: "grey.100",
  borderRight: "none",
};

export default function SideLayout({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {!isDesktop && (
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            zIndex: (t) => t.zIndex.drawer + 1,
            bgcolor: "primary.dark",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menú de navegación"
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, flex: 1 }}>
              Ditto Army
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      <Box
        component="nav"
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
        aria-label="Navegación principal"
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={closeMobile}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": drawerPaperSx,
          }}
        >
          <DrawerPanel onNavigate={closeMobile} />
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": drawerPaperSx,
          }}
          open
        >
          <DrawerPanel />
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: "100%", md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minWidth: 0,
          minHeight: "100vh",
          p: { xs: 2, sm: 2.5, md: 3 },
          pt: { xs: 10, sm: 11, md: 3 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
