import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import EuroToCOPConverter from "../../utils/tasa";

export default function SideLayout({ children }: { children: ReactNode }) {
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
            to="/stock/apertura-sellado"
            className="block py-2 px-3 rounded hover:bg-gray-700 text-sm pl-6"
          >
            Apertura sellado
          </Link>
          <Link
            to="/incoming"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Compras en camino
          </Link>
          <Link
            to="/cotizar"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Cotizar carta
          </Link>
          <Link
            to="/cotizar/pedido-cliente"
            className="block py-2 px-3 rounded hover:bg-gray-700 text-sm pl-6"
          >
            Pedido CardTrader
          </Link>
          <Link
            to="/ventas"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Ventas
          </Link>
          <Link
            to="/ventas/consistencia"
            className="block py-2 px-3 rounded hover:bg-gray-700 text-sm pl-6"
          >
            Consistencia stock vs ventas
          </Link>
          <Link
            to="/ventas/historico"
            className="block py-2 px-3 rounded hover:bg-gray-700 text-sm pl-6"
          >
            Histórico de ventas
          </Link>
          <Link
            to="/propiedad"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Cartas en Propiedad
          </Link>
          <Link
            to="/clientes"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Clientes
          </Link>
          <Link
            to="/clientes/imprimir-pedidos"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Imprimir pedidos
          </Link>
          <Link
            to="/escanear-codigo"
            className="block py-2 px-3 rounded hover:bg-gray-700"
          >
            Escanear código de barras
          </Link>
          <EuroToCOPConverter />
        </nav>
      </aside>

      {/* Contenido */}
      <main className="flex-1 bg-gray-100 p-6 overflow-auto">{children}</main>
    </div>
  );
}
