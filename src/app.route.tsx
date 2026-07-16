import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/home/home";
import SideLayout from "./components/layout/side-layout";
import Stock from "./pages/stock/create-stock/stock";
import AperturaSelladoPage from "./pages/stock/apertura-sellado/apertura-sellado";
import StockGrid from "./pages/stock/grid-stock";
import ModificarStock from "./pages/stock/update-stock/update-stock";
import AddPVP from "./pages/pvp/add-pvp/add-pvp";
import PropertyList from "./pages/sales/property-list";
import SalesDashboard from "./pages/sales/sales-dashboard";
import SalesConsistency from "./pages/sales/sales-consistency";
import SalesHistory from "./pages/sales/sales-history";
import ClientesPage from "./pages/clientes/clientes";
import ClienteDetallePage from "./pages/clientes/cliente-detalle";
import ReservarCartasPage from "./pages/clientes/reservar-cartas";
import ImprimirPedidosPage from "./pages/clientes/imprimir-pedidos";
import IncomingListPage from "./pages/incoming/incoming-list/incoming-list";
import IncomingCreatePage from "./pages/incoming/create/incoming-create";
import IncomingBatchRoundsPage from "./pages/incoming/batch-rounds/incoming-batch-rounds";
import IncomingRoundReviewPage from "./pages/incoming/round-review/incoming-round-review";
import IncomingShipRoundReviewPage from "./pages/incoming/ship-round-review/incoming-ship-round-review";
import IncomingV2Page from "./pages/incoming-v2/incoming-v2-page";
import CotizarCardtraderPage from "./pages/cotizar/cotizar-cardtrader-page";
import CotizarPedidoClientePage from "./pages/cotizar/cotizar-pedido-cliente-page";
import VentaAsistidaQrPage from "./pages/ventas/venta-asistida-qr-page";
import TestCardtraderPage from "./pages/test-cardtrader/test-cardtrader-page";
import CardtraderTransitListPage from "./pages/cardtrader-transit/cardtrader-transit-list-page";
import CardtraderTransitLotDetailPage from "./pages/cardtrader-transit/cardtrader-transit-lot-detail-page";
import CardtraderTransitImportPage from "./pages/cardtrader-transit/cardtrader-transit-import-page";
import CardtraderReceiptPage from "./pages/cardtrader-receipt/cardtrader-receipt-page";
import StockReviewStartPage from "./pages/stock/revision/start-page";
import StockReviewVerifyPage from "./pages/stock/revision/verify-page";
import StockReviewResolvePage from "./pages/stock/revision/resolve-page";
import StockLostCardsPage from "./pages/stock/lost-cards";
import ImprimirEtiquetasQrPage from "./pages/stock/imprimir-etiquetas-qr-page";
import NovedadStockPage from "./pages/incoming/novedad-stock/novedad-stock-page";

export default function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <SideLayout>
            <Home />
          </SideLayout>
        }
      />
      <Route
        path="/stock"
        element={
          <SideLayout>
            <StockGrid />
          </SideLayout>
        }
      />
      <Route
        path="/stock/apertura-sellado"
        element={
          <SideLayout>
            <AperturaSelladoPage />
          </SideLayout>
        }
      />
      <Route
        path="/stock/revision"
        element={
          <SideLayout>
            <StockReviewStartPage />
          </SideLayout>
        }
      />
      <Route
        path="/stock/revision/:sessionId/resolucion"
        element={
          <SideLayout>
            <StockReviewResolvePage />
          </SideLayout>
        }
      />
      <Route
        path="/stock/revision/:sessionId"
        element={
          <SideLayout>
            <StockReviewVerifyPage />
          </SideLayout>
        }
      />
      <Route
        path="/stock/perdidas"
        element={
          <SideLayout>
            <StockLostCardsPage />
          </SideLayout>
        }
      />
      <Route
        path="/stock/imprimir-etiquetas-qr"
        element={
          <SideLayout>
            <ImprimirEtiquetasQrPage />
          </SideLayout>
        }
      />
      <Route
        path="/stock/update/:id"
        element={
          <SideLayout>
            <ModificarStock />
          </SideLayout>
        }
      />
      <Route
        path="/incoming"
        element={
          <SideLayout>
            <IncomingListPage />
          </SideLayout>
        }
      />
      <Route
        path="/incoming/new"
        element={
          <SideLayout>
            <IncomingCreatePage />
          </SideLayout>
        }
      />
      <Route
        path="/incoming/batch/:batchId"
        element={
          <SideLayout>
            <IncomingBatchRoundsPage />
          </SideLayout>
        }
      />
      <Route
        path="/incoming/batch/:batchId/round/:roundId"
        element={
          <SideLayout>
            <IncomingRoundReviewPage />
          </SideLayout>
        }
      />
      <Route
        path="/incoming/ship-round/:roundId"
        element={
          <SideLayout>
            <IncomingShipRoundReviewPage />
          </SideLayout>
        }
      />
      <Route
        path="/incoming-v2"
        element={
          <SideLayout>
            <IncomingV2Page />
          </SideLayout>
        }
      />
      <Route
        path="/incoming/novedad-stock"
        element={
          <SideLayout>
            <NovedadStockPage />
          </SideLayout>
        }
      />
      <Route
        path="/add-stock"
        element={
          <SideLayout>
            <Stock />
          </SideLayout>
        }
      />
      <Route
        path="/add-pvp/:id"
        element={
          <SideLayout>
            <AddPVP />
          </SideLayout>
        }
      />
      <Route
        path="/cotizar"
        element={
          <SideLayout>
            <CotizarCardtraderPage />
          </SideLayout>
        }
      />
      <Route
        path="/cotizar/pedido-cliente"
        element={
          <SideLayout>
            <CotizarPedidoClientePage />
          </SideLayout>
        }
      />
      <Route
        path="/cardtrader-transit"
        element={
          <SideLayout>
            <CardtraderTransitListPage />
          </SideLayout>
        }
      />
      <Route
        path="/cardtrader-transit/import"
        element={
          <SideLayout>
            <CardtraderTransitImportPage />
          </SideLayout>
        }
      />
      <Route
        path="/cardtrader-transit/lot/:lotId"
        element={
          <SideLayout>
            <CardtraderTransitLotDetailPage />
          </SideLayout>
        }
      />
      <Route
        path="/cardtrader-receipt"
        element={
          <SideLayout>
            <CardtraderReceiptPage />
          </SideLayout>
        }
      />
      <Route
        path="/test-cardtrader"
        element={
          <SideLayout>
            <TestCardtraderPage />
          </SideLayout>
        }
      />
      <Route
        path="/ventas"
        element={
          <SideLayout>
            <SalesDashboard />
          </SideLayout>
        }
      />
      <Route
        path="/ventas/consistencia"
        element={
          <SideLayout>
            <SalesConsistency />
          </SideLayout>
        }
      />
      <Route
        path="/ventas/escanear-qr"
        element={
          <SideLayout>
            <VentaAsistidaQrPage />
          </SideLayout>
        }
      />
      <Route
        path="/ventas/historico"
        element={
          <SideLayout>
            <SalesHistory />
          </SideLayout>
        }
      />
      <Route
        path="/propiedad"
        element={
          <SideLayout>
            <PropertyList />
          </SideLayout>
        }
      />
      <Route
        path="/clientes"
        element={
          <SideLayout>
            <ClientesPage />
          </SideLayout>
        }
      />
      <Route
        path="/clientes/imprimir-pedidos"
        element={
          <SideLayout>
            <ImprimirPedidosPage />
          </SideLayout>
        }
      />
      <Route
        path="/clientes/:clientId/reservar"
        element={
          <SideLayout>
            <ReservarCartasPage />
          </SideLayout>
        }
      />
      <Route
        path="/clientes/:clientId"
        element={
          <SideLayout>
            <ClienteDetallePage />
          </SideLayout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
