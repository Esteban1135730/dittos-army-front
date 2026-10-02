import React from "react";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./app.route";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { OwnerProvider } from "./modules/owner";
import { dittoTheme } from "./theme";
import "./config/api";
import { currentPanelTcg, panelBasenameForPath, redirectLegacyPanelPath } from "./config/routes";

const panelBasename = panelBasenameForPath(window.location.pathname);
if (panelBasename) {
  const panelTcg = currentPanelTcg();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 60 * 24, // 24 hours
      },
    },
  });

  const localStoragePersister = createSyncStoragePersister({
    storage: window.localStorage,
    key: `dittos-react-query-${panelTcg}`,
  });

  persistQueryClient({
    queryClient,
    persister: localStoragePersister,
    buster: panelTcg,
  });
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ThemeProvider theme={dittoTheme}>
        <CssBaseline />
        <QueryClientProvider client={queryClient}>
          <OwnerProvider>
            <BrowserRouter basename={panelBasename}>
              <AppRouter />
            </BrowserRouter>
          </OwnerProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </React.StrictMode>,
  );
} else {
  redirectLegacyPanelPath();
}
