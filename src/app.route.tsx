import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/home/home";
import SideLayout from "./components/layout/side-layout";
import Stock from "./pages/stock/create-stock/stock";
import StockGrid from "./pages/stock/grid-stock";
import ModificarStock from "./pages/stock/update-stock/update-stock";
import AddPVP from "./pages/pvp/add-pvp/add-pvp";
import PropertyList from "./pages/sales/property-list";
import SalesDashboard from "./pages/sales/sales-dashboard";
import SalesConsistency from "./pages/sales/sales-consistency";
import SalesHistory from "./pages/sales/sales-history";
import ClientesPage from "./pages/clientes/clientes";
import ReservarCartasPage from "./pages/clientes/reservar-cartas";
import ImprimirPedidosPage from "./pages/clientes/imprimir-pedidos";

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
        path="/stock/update/:id"
        element={
          <SideLayout>
            <ModificarStock />
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
            <div>2</div>
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
        path="/clientes"
        element={
          <SideLayout>
            <ClientesPage />
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
        path="/clientes/imprimir-pedidos"
        element={
          <SideLayout>
            <ImprimirPedidosPage />
          </SideLayout>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
