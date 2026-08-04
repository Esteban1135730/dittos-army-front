import React from "react";
import { BrowserRouter } from "react-router-dom";
import AppRouter from "./app.route";
import { createRoot } from "react-dom/client";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { OwnerProvider } from "./modules/owner";
import "./config/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
});

const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
});

persistQueryClient({
  queryClient,
  persister: localStoragePersister,
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <OwnerProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </OwnerProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
