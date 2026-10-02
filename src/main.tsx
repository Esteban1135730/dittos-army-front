import React from "react";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./app.route";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import axios from "axios";
import { QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { OwnerProvider } from "./modules/owner";
import { dittoTheme } from "./theme";
import "./config/api";
import {
  createPanelQueryClient,
  installStaleOnWriteInterceptor,
  shouldPersistQuery,
} from "./config/query-client";
import { currentPanelTcg, panelBasenameForPath, redirectLegacyPanelPath } from "./config/routes";

/** Subir al cambiar qué se persiste: descarta cachés antiguas guardadas en localStorage. */
const QUERY_PERSIST_VERSION = "v2";

const panelBasename = panelBasenameForPath(window.location.pathname);
if (panelBasename) {
  const panelTcg = currentPanelTcg();
  const queryClient = createPanelQueryClient();
  installStaleOnWriteInterceptor(queryClient, axios);

  const localStoragePersister = createSyncStoragePersister({
    storage: window.localStorage,
    key: `dittos-react-query-${panelTcg}`,
    throttleTime: 3000,
  });

  persistQueryClient({
    queryClient,
    persister: localStoragePersister,
    buster: `${panelTcg}:${QUERY_PERSIST_VERSION}`,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
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
