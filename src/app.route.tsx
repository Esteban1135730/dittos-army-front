import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";
import SideLayout from "./components/layout/side-layout";
import { LoadingScreen } from "./components/loading";

const Home = lazy(() => import("./pages/home/home"));
const Stock = lazy(() => import("./pages/stock/create-stock/stock"));
const AperturaSelladoPage = lazy(() => import("./pages/stock/apertura-sellado/apertura-sellado"));
const StockGrid = lazy(() => import("./pages/stock/grid-stock"));
const ModificarStock = lazy(() => import("./pages/stock/update-stock/update-stock"));
const AddPVP = lazy(() => import("./pages/pvp/add-pvp/add-pvp"));
const PropertyList = lazy(() => import("./pages/sales/property-list"));
const SalesDashboard = lazy(() => import("./pages/sales/sales-dashboard"));
const SalesHistory = lazy(() => import("./pages/sales/sales-history"));
const ClientesPage = lazy(() => import("./pages/clientes/clientes"));
const ClienteDetallePage = lazy(() => import("./pages/clientes/cliente-detalle"));
const ReservarCartasPage = lazy(() => import("./pages/clientes/reservar-cartas"));
const ImprimirPedidosPage = lazy(() => import("./pages/clientes/imprimir-pedidos"));
const IncomingShipRoundReviewPage = lazy(
  () => import("./pages/incoming-v2/ship-round-review/incoming-ship-round-review"),
);
const IncomingV2Page = lazy(() => import("./pages/incoming-v2/incoming-v2-page"));
const NovedadStockPage = lazy(() => import("./pages/incoming-v2/novedad-stock/novedad-stock-page"));
const CotizarCardtraderPage = lazy(() => import("./pages/cotizar/cotizar-cardtrader-page"));
const CotizarPedidoClientePage = lazy(() => import("./pages/cotizar/cotizar-pedido-cliente-page"));
const VentaAsistidaQrPage = lazy(() => import("./pages/ventas/venta-asistida-qr-page"));
const CardtraderTransitListPage = lazy(
  () => import("./pages/cardtrader-transit/cardtrader-transit-list-page"),
);
const CardtraderTransitLotDetailPage = lazy(
  () => import("./pages/cardtrader-transit/cardtrader-transit-lot-detail-page"),
);
const CardtraderTransitImportPage = lazy(
  () => import("./pages/cardtrader-transit/cardtrader-transit-import-page"),
);
const CardtraderReceiptPage = lazy(() => import("./pages/cardtrader-receipt/cardtrader-receipt-page"));
const StockReviewStartPage = lazy(() => import("./pages/stock/revision/start-page"));
const StockReviewVerifyPage = lazy(() => import("./pages/stock/revision/verify-page"));
const StockReviewResolvePage = lazy(() => import("./pages/stock/revision/resolve-page"));
const StockLostCardsPage = lazy(() => import("./pages/stock/lost-cards"));
const ImprimirEtiquetasQrPage = lazy(() => import("./pages/stock/imprimir-etiquetas-qr-page"));
const MetricasPage = lazy(() => import("./pages/metricas/metricas-page"));

function RedirectLegacyIncomingShipRound() {
  const { roundId } = useParams<{ roundId: string }>();
  return <Navigate to={`/incoming-v2/ship-round/${roundId ?? ""}`} replace />;
}

function LayoutPage({ children }: { children: React.ReactNode }) {
  return <SideLayout>{children}</SideLayout>;
}

export default function AppRouter() {
  return (
    <Suspense fallback={<LoadingScreen variant="fullscreen" message="Iniciando panel…" />}>
      <Routes>
        <Route
          path="/"
          element={
            <LayoutPage>
              <Home />
            </LayoutPage>
          }
        />
        <Route
          path="/stock"
          element={
            <LayoutPage>
              <StockGrid />
            </LayoutPage>
          }
        />
        <Route
          path="/stock/apertura-sellado"
          element={
            <LayoutPage>
              <AperturaSelladoPage />
            </LayoutPage>
          }
        />
        <Route
          path="/stock/revision"
          element={
            <LayoutPage>
              <StockReviewStartPage />
            </LayoutPage>
          }
        />
        <Route
          path="/stock/revision/:sessionId/resolucion"
          element={
            <LayoutPage>
              <StockReviewResolvePage />
            </LayoutPage>
          }
        />
        <Route
          path="/stock/revision/:sessionId"
          element={
            <LayoutPage>
              <StockReviewVerifyPage />
            </LayoutPage>
          }
        />
        <Route
          path="/stock/perdidas"
          element={
            <LayoutPage>
              <StockLostCardsPage />
            </LayoutPage>
          }
        />
        <Route
          path="/stock/imprimir-etiquetas-qr"
          element={
            <LayoutPage>
              <ImprimirEtiquetasQrPage />
            </LayoutPage>
          }
        />
        <Route
          path="/stock/update/:id"
          element={
            <LayoutPage>
              <ModificarStock />
            </LayoutPage>
          }
        />
        <Route path="/incoming" element={<Navigate to="/incoming-v2" replace />} />
        <Route path="/incoming/new" element={<Navigate to="/incoming-v2" replace />} />
        <Route path="/incoming/batch/*" element={<Navigate to="/incoming-v2" replace />} />
        <Route path="/incoming/novedad-stock" element={<Navigate to="/incoming-v2/novedad-stock" replace />} />
        <Route path="/incoming/ship-round/:roundId" element={<RedirectLegacyIncomingShipRound />} />
        <Route
          path="/incoming-v2"
          element={
            <LayoutPage>
              <IncomingV2Page />
            </LayoutPage>
          }
        />
        <Route
          path="/incoming-v2/ship-round/:roundId"
          element={
            <LayoutPage>
              <IncomingShipRoundReviewPage />
            </LayoutPage>
          }
        />
        <Route
          path="/incoming-v2/novedad-stock"
          element={
            <LayoutPage>
              <NovedadStockPage />
            </LayoutPage>
          }
        />
        <Route
          path="/add-stock"
          element={
            <LayoutPage>
              <Stock />
            </LayoutPage>
          }
        />
        <Route
          path="/add-pvp/:id"
          element={
            <LayoutPage>
              <AddPVP />
            </LayoutPage>
          }
        />
        <Route
          path="/cotizar"
          element={
            <LayoutPage>
              <CotizarCardtraderPage />
            </LayoutPage>
          }
        />
        <Route
          path="/cotizar/pedido-cliente"
          element={
            <LayoutPage>
              <CotizarPedidoClientePage />
            </LayoutPage>
          }
        />
        <Route
          path="/cotizar/pedido-cliente/:sessionId"
          element={
            <LayoutPage>
              <CotizarPedidoClientePage />
            </LayoutPage>
          }
        />
        <Route
          path="/cardtrader-transit"
          element={
            <LayoutPage>
              <CardtraderTransitListPage />
            </LayoutPage>
          }
        />
        <Route
          path="/cardtrader-transit/import"
          element={
            <LayoutPage>
              <CardtraderTransitImportPage />
            </LayoutPage>
          }
        />
        <Route
          path="/cardtrader-transit/lot/:lotId"
          element={
            <LayoutPage>
              <CardtraderTransitLotDetailPage />
            </LayoutPage>
          }
        />
        <Route
          path="/cardtrader-receipt"
          element={
            <LayoutPage>
              <CardtraderReceiptPage />
            </LayoutPage>
          }
        />
        <Route
          path="/ventas"
          element={
            <LayoutPage>
              <SalesDashboard />
            </LayoutPage>
          }
        />
        <Route
          path="/metricas"
          element={
            <LayoutPage>
              <MetricasPage />
            </LayoutPage>
          }
        />
        <Route
          path="/ventas/escanear-qr"
          element={
            <LayoutPage>
              <VentaAsistidaQrPage />
            </LayoutPage>
          }
        />
        <Route
          path="/ventas/historico"
          element={
            <LayoutPage>
              <SalesHistory />
            </LayoutPage>
          }
        />
        <Route
          path="/propiedad"
          element={
            <LayoutPage>
              <PropertyList />
            </LayoutPage>
          }
        />
        <Route
          path="/clientes"
          element={
            <LayoutPage>
              <ClientesPage />
            </LayoutPage>
          }
        />
        <Route
          path="/clientes/imprimir-pedidos"
          element={
            <LayoutPage>
              <ImprimirPedidosPage />
            </LayoutPage>
          }
        />
        <Route
          path="/clientes/:clientId/reservar"
          element={
            <LayoutPage>
              <ReservarCartasPage />
            </LayoutPage>
          }
        />
        <Route
          path="/clientes/:clientId"
          element={
            <LayoutPage>
              <ClienteDetallePage />
            </LayoutPage>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
