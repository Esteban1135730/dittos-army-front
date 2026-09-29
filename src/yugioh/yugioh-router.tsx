import { PanelRoutes } from "../panel/panel-routes";
import YugiohAddStockPage from "./add-stock-page";

/** Panel Yu-Gi-Oh: mismas pantallas compartidas (cotizar, tránsito, clientes…). */
export default function YugiohRouter() {
  return <PanelRoutes surface="yugioh" AddStockPage={YugiohAddStockPage} />;
}
