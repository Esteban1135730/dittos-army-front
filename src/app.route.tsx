import { Routes, Route } from "react-router-dom";
import Login from "./pages/login/login";
import ProtectedRoute from "./components/protected.route";
import Home from "./pages/home/home";
import SideLayout from "./components/layout/side-layout";
import Stock from "./pages/stock/create-stock/stock";
import StockGrid from "./pages/stock/grid-stock";
import ModificarStock from "./pages/stock/update-stock/update-stock";
import AddPVP from "./pages/pvp/add-pvp/add-pvp";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <SideLayout>
              <Home />
            </SideLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stock"
        element={
          <ProtectedRoute>
            <SideLayout>
              <StockGrid />
            </SideLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock/update/:id"
        element={
          <ProtectedRoute>
            <SideLayout>
              <ModificarStock />
            </SideLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-stock"
        element={
          <ProtectedRoute>
            <SideLayout>
              <Stock />
            </SideLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-pvp/:id"
        element={
          <ProtectedRoute>
            <SideLayout>
              <AddPVP />
            </SideLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/cotizar"
        element={
          <ProtectedRoute>
            <SideLayout>
              <div>2</div>
            </SideLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ventas"
        element={
          <ProtectedRoute>
            <SideLayout>
              <div>3</div>
            </SideLayout>
          </ProtectedRoute>
        }
      />
      {/* Fallback */}
      <Route path="*" element={<Login />} />
    </Routes>
  );
}
