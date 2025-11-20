import type { ReactNode } from "react";
import { useAuth } from "../../context/auth.context";
import { Link, useNavigate } from "react-router-dom";
import EuroToCOPConverter from "../../utils/tasa";

export default function SideLayout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white flex flex-col p-4">
        <h2 className="text-xl font-bold mb-6">Mi App</h2>
        <nav className="flex-1 space-y-2">
          <Link to="/" className="block py-2 px-3 rounded hover:bg-gray-700">
            Inicio
          </Link>
          <Link
            to="/add-stock"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Agregar Stock
          </Link>
          <Link
            to="/stock"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Stock
          </Link>
          <Link
            to="/cotizar"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Cotizar carta
          </Link>
          <Link
            to="/ventas"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Ventas
          </Link>
          <Link
            to="/propiedad"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Cartas en Propiedad
          </Link>
          <EuroToCOPConverter />
        </nav>
        <button
          onClick={handleLogout}
          className="mt-auto bg-red-500 px-3 py-2 rounded hover:bg-red-600"
        >
          Cerrar sesión
        </button>
      </aside>

      {/* Contenido */}
      <main className="flex-1 bg-gray-100 p-6 overflow-auto">{children}</main>
    </div>
  );
}
