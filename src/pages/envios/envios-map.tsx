import { useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Box, Button, Stack, Typography } from "@mui/material";
import "leaflet/dist/leaflet.css";
import { entregaUrgencia } from "../clientes/pedido-ui-utils";
import { groupDomicilioPins, groupTiendaPins, type EnviosMapPin } from "./map-pins";
import type { GeocodePoint } from "./geocode-nominatim";
import type { PedidoCalendarioItem } from "./types";

const BOGOTA: [number, number] = [4.65, -74.08];
const PRIMARY = "#6D5CE8";
const DEFAULT_PIN = "#6B6578";

type Props = {
  items: PedidoCalendarioItem[];
  coordsByAddress: Record<string, GeocodePoint | null>;
  onEditItem: (item: PedidoCalendarioItem) => void;
};

function pinIcon(kind: "tienda" | "domicilio", count: number) {
  const color = kind === "tienda" ? PRIMARY : DEFAULT_PIN;
  const label = count > 1 ? String(count) : "";
  return L.divIcon({
    className: "envios-pin",
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:${color};
      border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);color:#fff;font:700 11px/1 sans-serif">${label}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -24],
  });
}

function PinPopup({ pin, onEditItem }: { pin: EnviosMapPin; onEditItem: Props["onEditItem"] }) {
  return (
    <Stack spacing={0.75} sx={{ minWidth: 160, maxWidth: 240 }}>
      <Typography variant="subtitle2" fontWeight={800}>
        {pin.label}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {pin.items.length} envío{pin.items.length === 1 ? "" : "s"}
      </Typography>
      {pin.items.map((item) => {
        const overdue =
          item.overdue ||
          entregaUrgencia(item.fecha_tentativa_entrega, item.status) === "overdue";
        return (
          <Button
            key={item.id}
            size="small"
            variant="text"
            onClick={() => onEditItem(item)}
            sx={{
              justifyContent: "flex-start",
              textTransform: "none",
              fontWeight: 600,
              color: overdue ? "error.main" : "text.primary",
              px: 0,
            }}
          >
            {item.client_name}
          </Button>
        );
      })}
    </Stack>
  );
}

export default function EnviosMap({ items, coordsByAddress, onEditItem }: Props) {
  const pins = useMemo(
    () => [...groupTiendaPins(items), ...groupDomicilioPins(items, coordsByAddress)],
    [items, coordsByAddress],
  );

  return (
    <Box
      sx={{
        height: { xs: 320, md: 400 },
        width: "100%",
        borderRadius: 2,
        overflow: "hidden",
        border: 1,
        borderColor: "divider",
        "& .leaflet-container": { height: "100%", width: "100%", zIndex: 0 },
      }}
    >
      <MapContainer
        center={BOGOTA}
        zoom={12}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={[pin.lat, pin.lng]}
            icon={pinIcon(pin.kind, pin.items.length)}
          >
            <Popup>
              <PinPopup pin={pin} onEditItem={onEditItem} />
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </Box>
  );
}
