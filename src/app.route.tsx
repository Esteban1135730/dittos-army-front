import { lazy } from "react";
import { PanelRoutes } from "./panel/panel-routes";

const Stock = lazy(() => import("./pages/stock/create-stock/stock"));

/** Panel Pokémon: mismas pantallas compartidas + flujos solo Pokémon. */
export default function AppRouter() {
  return <PanelRoutes surface="pokemon" AddStockPage={Stock} />;
}
