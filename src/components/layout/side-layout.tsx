import { useState, type ReactNode } from "react";
import useMediaQuery from "@mui/material/useMediaQuery";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import PanelNav from "./panel-nav";

const DRAWER_WIDTH = 256;

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" />
    </svg>
  );
}

export default function SideLayout({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width:900px)");
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const sidebarContent = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        p: 2,
        color: "common.white",
      }}
    >
      <PanelNav onNavigate={closeMobile} collapseRates={!isDesktop} />
    </Box>
  );

  return (
    <Box sx={{ display: "flex", height: "100vh", minHeight: 0, bgcolor: "grey.100" }}>
      <Box
        component="aside"
        aria-label="Navegación principal"
        sx={{
          display: { xs: "none", md: "flex" },
          flexDirection: "column",
          flexShrink: 0,
          width: DRAWER_WIDTH,
          bgcolor: "grey.800",
        }}
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
            width: DRAWER_WIDTH,
            bgcolor: "grey.800",
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
            bgcolor: "grey.800",
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
            p: { xs: 1.5, sm: 2, md: 3 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
