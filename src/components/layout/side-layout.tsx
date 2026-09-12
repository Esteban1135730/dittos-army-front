import { Suspense, useState, type ReactNode } from "react";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { LoadingScreen } from "../loading";
import PanelNav from "./panel-nav";
import { OwnerRouteGuard } from "../../modules/owner";
import { PANEL_DRAWER_WIDTH_PX, PANEL_MAIN_PADDING } from "../../theme/panel-density";

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
    </svg>
  );
}

export default function SideLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const sidebarContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        px: 1.5,
        py: 1.75,
        color: "common.white",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 28%)",
      }}
    >
      <PanelNav onNavigate={closeMobile} />
    </Box>
  );

  return (
    <OwnerRouteGuard>
      <Box sx={{ display: "flex", height: "100vh", minHeight: 0, bgcolor: "background.default" }}>
        <Box
          component="aside"
          aria-label="Navegación principal"
          sx={(theme) => ({
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            flexShrink: 0,
            width: PANEL_DRAWER_WIDTH_PX,
            bgcolor: theme.palette.ditto.nav.bg,
            backgroundImage: `linear-gradient(180deg, ${theme.palette.ditto.nav.bgTop} 0%, ${theme.palette.ditto.nav.bg} 100%)`,
            borderRight: 1,
            borderColor: theme.palette.ditto.nav.border,
          })}
        >
          {sidebarContent}
        </Box>

        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={closeMobile}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              width: PANEL_DRAWER_WIDTH_PX,
              bgcolor: (theme) => theme.palette.ditto.nav.bg,
              boxSizing: "border-box",
            },
          }}
        >
          {sidebarContent}
        </Drawer>

        <Box
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <AppBar
            position="sticky"
            elevation={1}
            sx={{
              display: { xs: "block", md: "none" },
              bgcolor: (theme) => theme.palette.ditto.nav.bg,
            }}
          >
            <Toolbar sx={{ minHeight: { xs: 56 }, gap: 1 }}>
              <IconButton
                color="inherit"
                edge="start"
                aria-label="Abrir menú de navegación"
                onClick={() => setMobileOpen(true)}
                sx={{ width: 44, height: 44 }}
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" component="div" fontWeight={700} noWrap>
                Dittos Army
              </Typography>
            </Toolbar>
          </AppBar>

          <Box
            component="main"
            sx={{
              flex: 1,
              overflow: "auto",
              minHeight: 0,
              p: PANEL_MAIN_PADDING,
            }}
          >
            <Suspense fallback={<LoadingScreen message="Cargando pantalla…" />}>
              {children}
            </Suspense>
          </Box>
        </Box>
      </Box>
    </OwnerRouteGuard>
  );
}
