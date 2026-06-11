import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import EuroToCOPConverter from "../../utils/tasa";

type PanelNavProps = {
  onNavigate?: () => void;
  collapseRates?: boolean;
};

const linkClass =
  "block py-2 px-3 rounded hover:bg-gray-700 transition-colors";
const subLinkClass = `${linkClass} text-sm pl-6`;

function NavLink({
  to,
  children,
  className = linkClass,
  onNavigate,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <Link to={to} className={className} onClick={onNavigate}>
      {children}
    </Link>
  );
}

export default function PanelNav({ onNavigate, collapseRates = false }: PanelNavProps) {
  return (
    <>
      <h2 className="text-xl font-bold mb-6">Dittos Army</h2>
      <nav className="flex-1 space-y-2 overflow-y-auto">
        <NavLink to="/" onNavigate={onNavigate}>
          Inicio
        </NavLink>
        <NavLink to="/add-stock" onNavigate={onNavigate}>
          Agregar Stock
        </NavLink>
        <NavLink to="/stock" onNavigate={onNavigate}>
          Stock
        </NavLink>
        <NavLink to="/stock/apertura-sellado" className={subLinkClass} onNavigate={onNavigate}>
          Apertura sellado
        </NavLink>
        <NavLink to="/stock/revision" className={subLinkClass} onNavigate={onNavigate}>
          Revisión de stock
        </NavLink>
        <NavLink to="/stock/perdidas" className={subLinkClass} onNavigate={onNavigate}>
          Cartas perdidas
        </NavLink>
        <NavLink to="/incoming" onNavigate={onNavigate}>
          Compras en camino
        </NavLink>
        <NavLink to="/cotizar" onNavigate={onNavigate}>
          Cotizar carta
        </NavLink>
        <NavLink to="/cotizar/pedido-cliente" className={subLinkClass} onNavigate={onNavigate}>
          Pedido CardTrader
        </NavLink>
        <NavLink to="/test-cardtrader" className={subLinkClass} onNavigate={onNavigate}>
          Consolidado tránsito
        </NavLink>
        <NavLink to="/ventas" onNavigate={onNavigate}>
          Ventas
        </NavLink>
        <NavLink to="/ventas/consistencia" className={subLinkClass} onNavigate={onNavigate}>
          Consistencia stock vs ventas
        </NavLink>
        <NavLink to="/ventas/escanear-qr" className={subLinkClass} onNavigate={onNavigate}>
          Venta asistida QR
        </NavLink>
        <NavLink to="/ventas/historico" className={subLinkClass} onNavigate={onNavigate}>
          Histórico de ventas
        </NavLink>
        <NavLink to="/propiedad" onNavigate={onNavigate}>
          Cartas en Propiedad
        </NavLink>
        <NavLink to="/clientes" onNavigate={onNavigate}>
          Clientes
        </NavLink>
        <NavLink to="/clientes/imprimir-pedidos" onNavigate={onNavigate}>
          Imprimir pedidos
        </NavLink>

        {collapseRates ? (
          <details className="mt-4 rounded bg-gray-900/40 group">
            <summary className="cursor-pointer list-none py-2 px-3 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                Tasas de cambio
                <span className="text-gray-400 text-xs group-open:rotate-180 transition-transform">
                  ▾
                </span>
              </span>
            </summary>
            <div className="px-1 pb-2">
              <EuroToCOPConverter />
            </div>
          </details>
        ) : (
          <EuroToCOPConverter />
        )}
      </nav>
    </>
  );
}
