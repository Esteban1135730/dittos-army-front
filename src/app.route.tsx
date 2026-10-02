import { lazy } from "react";
import { currentPanelTcg } from "./config/routes";
import { PanelRoutes } from "./panel/panel-routes";

const Stock = lazy(() => import("./pages/stock/create-stock/stock"));
const CatalogAddStockPage = lazy(
  () => import("./pages/stock/catalog-add-stock/catalog-add-stock-page"),
);

/** Mismas pantallas para todos los TCG; solo cambia el alta de stock (TCGdex vs catálogo externo). */
export default function AppRouter() {
  const tcg = currentPanelTcg();
  return (
    <PanelRoutes
      surface={tcg}
      AddStockPage={tcg === "pokemon" ? Stock : CatalogAddStockPage}
    />
  );
}
