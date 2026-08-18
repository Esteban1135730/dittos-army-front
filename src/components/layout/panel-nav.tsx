import type { ComponentType, SVGProps } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import EuroToCOPConverter from "../../utils/tasa";
import { OwnerSelect, useOwner } from "../../modules/owner";
import { OWNERS_CONFIG, type OwnerKey } from "../../config/owners";
import { isRouteAllowed } from "../../modules/owner/owner-acl";
import { runOwnerChangeGuards } from "../../modules/owner/owner-change-guard";
import {
  IconAlert,
  IconBookmark,
  IconCart,
  IconCash,
  IconChevron,
  IconDownload,
  IconGrid,
  IconHistory,
  IconHome,
  IconInbox,
  IconInventory,
  IconLayers,
  IconPackage,
  IconPlus,
  IconPrint,
  IconQr,
  IconRates,
  IconScan,
  IconSearch,
  IconTag,
  IconTruck,
  IconUsers,
} from "./panel-nav-icons";

type IconComp = ComponentType<SVGProps<SVGSVGElement>>;

type PanelNavProps = {
  onNavigate?: () => void;
  /** Confirm before switching owner (e.g. clear QR cart). */
  onBeforeOwnerChange?: (next: OwnerKey) => boolean;
};

type NavLeaf = {
  to: string;
  label: string;
  icon: IconComp;
  badge?: "legacy" | "v2";
};

type NavSection = {
  id: string;
  label: string;
  icon: IconComp;
  items: NavLeaf[];
};

const TOP_LINKS: NavLeaf[] = [
  { to: "/", label: "Inicio", icon: IconHome },
];

const SECTIONS: NavSection[] = [
  {
    id: "inventario",
    label: "Inventario",
    icon: IconInventory,
    items: [
      { to: "/stock", label: "Stock", icon: IconGrid },
      { to: "/add-stock", label: "Agregar stock", icon: IconPlus },
      { to: "/stock/apertura-sellado", label: "Apertura sellado", icon: IconPackage },
      { to: "/stock/revision", label: "Revisión de stock", icon: IconSearch },
      { to: "/stock/perdidas", label: "Cartas perdidas", icon: IconAlert },
      { to: "/stock/imprimir-etiquetas-qr", label: "Etiquetas QR", icon: IconQr },
    ],
  },
  {
    id: "cardtrader",
    label: "CardTrader",
    icon: IconTruck,
    items: [
      { to: "/cardtrader-transit", label: "Tránsito", icon: IconTruck },
      { to: "/cardtrader-transit/import", label: "Importar CT Zero", icon: IconDownload },
      { to: "/cardtrader-receipt", label: "Recepción CT", icon: IconInbox },
      { to: "/incoming-v2", label: "Homologación CT", icon: IconLayers },
      { to: "/incoming-v2/novedad-stock", label: "Cartas con novedad", icon: IconAlert },
      { to: "/cotizar", label: "Cotizar carta", icon: IconTag },
      { to: "/cotizar/pedido-cliente", label: "Pedido CardTrader", icon: IconCart },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    icon: IconCash,
    items: [
      { to: "/ventas", label: "Dashboard", icon: IconCash },
      { to: "/metricas", label: "Métricas", icon: IconRates },
      { to: "/ventas/escanear-qr", label: "Venta asistida QR", icon: IconScan },
      { to: "/ventas/historico", label: "Histórico", icon: IconHistory },
      { to: "/propiedad", label: "En propiedad", icon: IconBookmark },
    ],
  },
  {
    id: "clientes",
    label: "Clientes",
    icon: IconUsers,
    items: [
      { to: "/clientes", label: "Clientes", icon: IconUsers },
      { to: "/clientes/imprimir-pedidos", label: "Imprimir pedidos", icon: IconPrint },
    ],
  },
];

function pathMatches(pathname: string, to: string): boolean {
  if (to === "/") return pathname === "/" || pathname === "";
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Prefer the longest matching leaf so `/stock/revision` does not also light up `/stock`. */
function isLeafActive(pathname: string, to: string, siblings: NavLeaf[]): boolean {
  if (!pathMatches(pathname, to)) return false;
  const longerMatch = siblings.some(
    (s) => s.to !== to && s.to.length > to.length && pathMatches(pathname, s.to),
  );
  return !longerMatch;
}

function sectionContainsPath(section: NavSection, pathname: string): boolean {
  return section.items.some((item) => pathMatches(pathname, item.to));
}

function Badge({ kind }: { kind: "legacy" | "v2" }) {
  const styles =
    kind === "v2"
      ? "bg-sky-500/20 text-sky-300"
      : "bg-amber-500/15 text-amber-300";
  return (
    <span
      className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${styles}`}
    >
      {kind}
    </span>
  );
}

function NavItemLink({
  item,
  active,
  indented,
  onNavigate,
}: {
  item: NavLeaf;
  active: boolean;
  indented?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={[
        "group flex items-center gap-2.5 rounded-md px-2.5 text-[13px] leading-tight transition-colors",
        indented ? "py-1.5 pl-3" : "py-2",
        active
          ? "bg-white/10 text-white font-medium"
          : "text-gray-300 hover:bg-white/5 hover:text-white",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          active ? "bg-white/10 text-white" : "text-gray-400 group-hover:text-gray-200",
        ].join(" ")}
      >
        <Icon />
      </span>
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? <Badge kind={item.badge} /> : null}
    </Link>
  );
}

function NavGroup({
  section,
  pathname,
  onNavigate,
}: {
  section: NavSection;
  pathname: string;
  onNavigate?: () => void;
}) {
  const SectionIcon = section.icon;
  const openByDefault = sectionContainsPath(section, pathname);

  return (
    <details
      key={`${section.id}-${openByDefault ? "open" : "closed"}`}
      open={openByDefault}
      className="group/section"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 select-none hover:bg-white/5 hover:text-gray-200 [&::-webkit-details-marker]:hidden">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center text-gray-500">
          <SectionIcon />
        </span>
        <span className="flex-1">{section.label}</span>
        <span className="text-gray-500 transition-transform group-open/section:rotate-180">
          <IconChevron />
        </span>
      </summary>
      <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
        {section.items.map((item) => (
          <NavItemLink
            key={item.to}
            item={item}
            indented
            active={isLeafActive(pathname, item.to, section.items)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </details>
  );
}

export default function PanelNav({
  onNavigate,
  onBeforeOwnerChange,
}: PanelNavProps) {
  const { allowedFeatures } = useOwner();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const visibleTop = TOP_LINKS.filter((item) =>
    isRouteAllowed(item.to, allowedFeatures),
  );

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      isRouteAllowed(item.to, allowedFeatures),
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0 space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">
            Panel
          </p>
          <h2 className="text-lg font-bold tracking-tight text-white">
            Dittos Army
          </h2>
        </div>
        <OwnerSelect
          onBeforeChange={(next) => {
            if (!runOwnerChangeGuards(next)) return false;
            if (onBeforeOwnerChange && !onBeforeOwnerChange(next)) return false;
            const nextFeatures = OWNERS_CONFIG.owners[next].allowedFeatures;
            if (!isRouteAllowed(window.location.pathname, nextFeatures)) {
              navigate("/");
            }
            return true;
          }}
        />
      </div>

      <nav
        className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent]"
        aria-label="M?dulos del panel"
      >
        {visibleTop.map((item) => (
          <NavItemLink
            key={item.to}
            item={item}
            active={isLeafActive(pathname, item.to, visibleTop)}
            onNavigate={onNavigate}
          />
        ))}

        <div className="my-2 h-px bg-white/10" />

        {visibleSections.map((section) => (
          <NavGroup
            key={section.id}
            section={section}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 pt-2">
        <details className="group/rates rounded-md bg-black/20">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2.5 py-2 text-[13px] text-gray-300 select-none hover:bg-white/5 hover:text-white [&::-webkit-details-marker]:hidden">
            <span className="flex h-7 w-7 items-center justify-center text-gray-400">
              <IconRates />
            </span>
            <span className="flex-1 font-medium">Tasas de cambio</span>
            <span className="text-gray-500 transition-transform group-open/rates:rotate-180">
              <IconChevron />
            </span>
          </summary>
          <div className="px-1.5 pb-2">
            <EuroToCOPConverter />
          </div>
        </details>
      </div>
    </div>
  );
}
