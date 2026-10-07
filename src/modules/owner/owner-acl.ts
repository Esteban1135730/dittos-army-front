import type { FeatureKey } from "../../config/owners";
import { TCG_UI_PREFIX } from "../../config/routes";

/**
 * Map pathname → feature key for ACL (034).
 * More specific prefixes first. Los prefijos TCG (`/pokemon`, `/yugioh`…) se ignoran.
 */
function panelPath(pathname: string): string {
  const path = pathname.split("?")[0] || "/";
  for (const prefix of Object.values(TCG_UI_PREFIX)) {
    if (path === prefix) return "/";
    if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  }
  return path;
}

const ROUTE_FEATURE_RULES: Array<{ prefix: string; feature: FeatureKey }> = [
  { prefix: "/ventas/escanear-qr", feature: "venta-asistida-qr" },
  { prefix: "/ventas/desde-movil", feature: "ventas" },
  { prefix: "/ventas", feature: "ventas" },
  { prefix: "/metricas", feature: "ventas" },
  { prefix: "/stock/revision-precios-pvp", feature: "stock" },
  { prefix: "/stock-pvp-benchmark", feature: "stock" },
  { prefix: "/add-stock", feature: "agregar-stock" },
  { prefix: "/stock/fotos-inventario", feature: "stock-inventario-fotos" },
  { prefix: "/stock", feature: "stock" },
  { prefix: "/propiedad", feature: "propiedad" },
  { prefix: "/facturacion-electronica", feature: "clientes" },
  { prefix: "/envios", feature: "clientes" },
  { prefix: "/clientes", feature: "clientes" },
  { prefix: "/cotizar", feature: "cotizar" },
  { prefix: "/cardtrader-transit", feature: "cardtrader" },
  { prefix: "/cardtrader-receipt", feature: "cardtrader" },
  { prefix: "/cardtrader", feature: "cardtrader" },
  { prefix: "/incoming-v2", feature: "incoming" },
  { prefix: "/generar-pdf-grupos", feature: "inicio" },
  { prefix: "/", feature: "inicio" },
];

export function routeToFeature(pathname: string): FeatureKey {
  const path = panelPath(pathname);
  for (const rule of ROUTE_FEATURE_RULES) {
    if (rule.prefix === "/") {
      if (path === "/" || path === "") return rule.feature;
      continue;
    }
    if (path === rule.prefix || path.startsWith(`${rule.prefix}/`)) {
      return rule.feature;
    }
  }
  // Default deny for unknown routes (guard redirects).
  return "cotizar";
}

export function isRouteAllowed(
  pathname: string,
  allowedFeatures: FeatureKey[],
): boolean {
  const feature = routeToFeature(pathname);
  return allowedFeatures.includes(feature);
}
