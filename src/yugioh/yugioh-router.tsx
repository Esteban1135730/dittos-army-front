import { lazy, type ReactNode } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import SideLayout from "../components/layout/side-layout";
import YugiohAddStockPage from "./add-stock-page";

const Home = lazy(() => import("../pages/home/home"));
const StockGrid = lazy(() => import("../pages/stock/grid-stock"));
const ModificarStock = lazy(() => import("../pages/stock/update-stock/update-stock"));
const AddPVP = lazy(() => import("../pages/pvp/add-pvp/add-pvp"));
const SalesDashboard = lazy(() => import("../pages/sales/sales-dashboard"));
const MetricasPage = lazy(() => import("../pages/metricas/metricas-page"));
const IncomingShipRoundReviewPage = lazy(
  () => import("../pages/incoming-v2/ship-round-review/incoming-ship-round-review"),
);
const IncomingV2Page = lazy(() => import("../pages/incoming-v2/incoming-v2-page"));
const NovedadStockPage = lazy(() => import("../pages/incoming-v2/novedad-stock/novedad-stock-page"));
const CotizarCardtraderPage = lazy(() => import("../pages/cotizar/cotizar-cardtrader-page"));
const CotizarPedidoClientePage = lazy(() => import("../pages/cotizar/cotizar-pedido-cliente-page"));
const CardtraderTransitListPage = lazy(
  () => import("../pages/cardtrader-transit/cardtrader-transit-list-page"),
);
const CardtraderTransitLotDetailPage = lazy(
  () => import("../pages/cardtrader-transit/cardtrader-transit-lot-detail-page"),
);
const CardtraderTransitImportPage = lazy(
  () => import("../pages/cardtrader-transit/cardtrader-transit-import-page"),
);
const CardtraderReceiptPage = lazy(() => import("../pages/cardtrader-receipt/cardtrader-receipt-page"));
const VentaAsistidaQrPage = lazy(() => import("../pages/ventas/venta-asistida-qr-page"));
const ClientesPage = lazy(() => import("../pages/clientes/clientes"));
const ClienteDetallePage = lazy(() => import("../pages/clientes/cliente-detalle"));
const ReservarCartasPage = lazy(() => import("../pages/clientes/reservar-cartas"));
const ImprimirPedidosPage = lazy(() => import("../pages/clientes/imprimir-pedidos"));
const EnviosPage = lazy(() => import("../pages/envios/envios"));
const StockReviewStartPage = lazy(() => import("../pages/stock/revision/start-page"));
const StockReviewVerifyPage = lazy(() => import("../pages/stock/revision/verify-page"));
const StockReviewResolvePage = lazy(() => import("../pages/stock/revision/resolve-page"));
const ImprimirEtiquetasQrPage = lazy(() => import("../pages/stock/imprimir-etiquetas-qr-page"));

function RedirectLegacyIncomingShipRound() {
  const { roundId } = useParams<{ roundId: string }>();
  return <Navigate to={`/incoming-v2/ship-round/${roundId ?? ""}`} replace />;
}

function Page({ children }: { children: ReactNode }) {
  return <SideLayout>{children}</SideLayout>;
}

export default function YugiohRouter() {
  return (
    <Routes>
      <Route path="/" element={<Page><Home /></Page>} />
      <Route path="/stock" element={<Page><StockGrid /></Page>} />
      <Route path="/stock/update/:id" element={<Page><ModificarStock /></Page>} />
      <Route path="/stock/revision" element={<Page><StockReviewStartPage /></Page>} />
      <Route path="/stock/revision/:sessionId/resolucion" element={<Page><StockReviewResolvePage /></Page>} />
      <Route path="/stock/revision/:sessionId" element={<Page><StockReviewVerifyPage /></Page>} />
      <Route path="/stock/imprimir-etiquetas-qr" element={<Page><ImprimirEtiquetasQrPage /></Page>} />
      <Route path="/add-stock" element={<Page><YugiohAddStockPage /></Page>} />
      <Route path="/add-pvp/:id" element={<Page><AddPVP /></Page>} />
      <Route path="/incoming" element={<Navigate to="/incoming-v2" replace />} />
      <Route path="/incoming/new" element={<Navigate to="/incoming-v2" replace />} />
      <Route path="/incoming/batch/*" element={<Navigate to="/incoming-v2" replace />} />
      <Route path="/incoming/novedad-stock" element={<Navigate to="/incoming-v2/novedad-stock" replace />} />
      <Route path="/incoming/ship-round/:roundId" element={<RedirectLegacyIncomingShipRound />} />
      <Route path="/incoming-v2" element={<Page><IncomingV2Page /></Page>} />
      <Route path="/incoming-v2/ship-round/:roundId" element={<Page><IncomingShipRoundReviewPage /></Page>} />
      <Route path="/incoming-v2/novedad-stock" element={<Page><NovedadStockPage /></Page>} />
      <Route path="/cotizar" element={<Page><CotizarCardtraderPage /></Page>} />
      <Route path="/cotizar/pedido-cliente" element={<Page><CotizarPedidoClientePage /></Page>} />
      <Route path="/cotizar/pedido-cliente/:sessionId" element={<Page><CotizarPedidoClientePage /></Page>} />
      <Route path="/cardtrader-transit" element={<Page><CardtraderTransitListPage /></Page>} />
      <Route path="/cardtrader-transit/import" element={<Page><CardtraderTransitImportPage /></Page>} />
      <Route path="/cardtrader-transit/lot/:lotId" element={<Page><CardtraderTransitLotDetailPage /></Page>} />
      <Route path="/cardtrader-receipt" element={<Page><CardtraderReceiptPage /></Page>} />
      <Route path="/ventas" element={<Page><SalesDashboard /></Page>} />
      <Route path="/metricas" element={<Page><MetricasPage /></Page>} />
      <Route path="/ventas/escanear-qr" element={<Page><VentaAsistidaQrPage /></Page>} />
      <Route path="/envios" element={<Page><EnviosPage /></Page>} />
      <Route path="/clientes" element={<Page><ClientesPage /></Page>} />
      <Route path="/clientes/imprimir-pedidos" element={<Page><ImprimirPedidosPage /></Page>} />
      <Route path="/clientes/:clientId/reservar" element={<Page><ReservarCartasPage /></Page>} />
      <Route path="/clientes/:clientId" element={<Page><ClienteDetallePage /></Page>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
