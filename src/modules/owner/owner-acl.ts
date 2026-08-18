import type { FeatureKey } from "../../config/owners";

/**
 * Map pathname → feature key for ACL (034).
 * More specific prefixes first.
 */
const ROUTE_FEATURE_RULES: Array<{ prefix: string; feature: FeatureKey }> = [
  { prefix: "/ventas/escanear-qr", feature: "venta-asistida-qr" },
  { prefix: "/ventas", feature: "ventas" },
  { prefix: "/metricas", feature: "ventas" },
  { prefix: "/add-stock", feature: "agregar-stock" },
  { prefix: "/stock", feature: "stock" },
  { prefix: "/propiedad", feature: "propiedad" },
  { prefix: "/clientes", feature: "clientes" },
  { prefix: "/cotizar", feature: "cotizar" },
  { prefix: "/cardtrader", feature: "cardtrader" },
  { prefix: "/incoming-v2", feature: "incoming" },
  { prefix: "/", feature: "inicio" },
];

export function routeToFeature(pathname: string): FeatureKey {
  const path = pathname.split("?")[0] || "/";
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
