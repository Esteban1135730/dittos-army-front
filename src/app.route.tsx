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
import FacturacionElectronicaPage from "./pages/facturacion/facturacion-electronica";
import CotizarPlaceholderPage from "./pages/cotizar/cotizar-placeholder";
import CartasHubPage from "./pages/cartas/cartas-hub";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/cartas/agregar" element={<Navigate to="/add-stock" replace />} />
      <Route path="/cartas/inventario" element={<Navigate to="/stock" replace />} />
      <Route
        path="/cartas/apertura-sellado"
        element={<Navigate to="/stock/apertura-sellado" replace />}
      />
      <Route
        path="/cartas"
        element={
          <SideLayout>
            <CartasHubPage />
          </SideLayout>
        }
      />
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
            <CotizarPlaceholderPage />
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
        path="/facturacion-electronica"
        element={
          <SideLayout>
            <FacturacionElectronicaPage />
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
